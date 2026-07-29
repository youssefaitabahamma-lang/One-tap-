const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const config = require('../config');
const { resolvePlaceholders } = require('./format');

/**
 * Custom error used to signal "user-facing" failures (bad input, no permission, etc.)
 * so handlers can reply with a clean message instead of a stack trace.
 */
class VoiceActionError extends Error {}

/**
 * Looks up the temp voice channel the given member is currently sitting in,
 * and validates it is one this bot manages.
 * @returns {{channel: import('discord.js').VoiceChannel, data: object}}
 */
function getUserTempChannel(member) {
  const channel = member.voice?.channel;
  if (!channel) {
    throw new VoiceActionError('You need to be in a temporary voice channel to use this.');
  }
  const data = db.getChannel(channel.id);
  if (!data) {
    throw new VoiceActionError('That is not a temporary voice channel managed by this bot.');
  }
  return { channel, data };
}

function isOwner(member, data) {
  return member.id === data.ownerId;
}

function requireOwner(member, data) {
  if (!isOwner(member, data)) {
    throw new VoiceActionError('Only the channel owner can do that. Try `.v claim` if the owner has left.');
  }
}

/**
 * Creates a brand-new temp channel when someone joins the "Join to Create" channel.
 */
async function createTempChannel(member, jtcChannel, guildConfig) {
  const guild = member.guild;
  const category = guild.channels.cache.get(guildConfig.categoryId);

  const name = resolvePlaceholders(config.defaultChannelName, { member }).slice(0, 100);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category ?? undefined,
    userLimit: 0,
    permissionOverwrites: [
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.Stream,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
        ],
      },
    ],
  });

  db.setChannel(channel.id, {
    guildId: guild.id,
    ownerId: member.id,
    locked: false,
    hidden: false,
    limit: 0,
    permitted: [],
    rejected: [],
    createdAt: Date.now(),
  });

  await member.voice.setChannel(channel).catch(() => {});
  return channel;
}

/**
 * Deletes a temp channel once it becomes empty (with a short grace delay
 * to avoid deleting a channel someone is mid-move into).
 */
async function cleanupIfEmpty(channel) {
  if (!channel || channel.deleted) return;
  const data = db.getChannel(channel.id);
  if (!data) return;

  setTimeout(async () => {
    try {
      const fresh = await channel.guild.channels.fetch(channel.id).catch(() => null);
      if (!fresh) {
        db.deleteChannel(channel.id);
        return;
      }
      if (fresh.members.size === 0) {
        await fresh.delete('Temporary voice channel empty.').catch(() => {});
        db.deleteChannel(channel.id);
      }
    } catch (err) {
      console.error('[tempChannel] cleanup error:', err);
    }
  }, config.deleteEmptyChannelDelayMs);
}

// ---------------- Owner actions ----------------

async function renameChannel(member, newName) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  if (!newName || newName.trim().length === 0) throw new VoiceActionError('Please provide a valid name.');
  if (newName.length > 100) throw new VoiceActionError('Channel names must be 100 characters or fewer.');
  await channel.setName(newName.trim());
  return `Channel renamed to **${newName.trim()}**.`;
}

async function setLimit(member, limitRaw) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  const limit = Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
    throw new VoiceActionError('Please provide a number between 0 (unlimited) and 99.');
  }
  await channel.setUserLimit(limit);
  db.setChannel(channel.id, { limit });
  return limit === 0 ? 'User limit removed â channel is now unlimited.' : `User limit set to **${limit}**.`;
}

async function lockChannel(member) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: false });
  db.setChannel(channel.id, { locked: true });
  return 'ð Channel locked. New members can no longer connect.';
}

async function unlockChannel(member) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { Connect: null });
  db.setChannel(channel.id, { locked: false });
  return 'ð Channel unlocked. Anyone can connect now.';
}

async function hideChannel(member) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { ViewChannel: false });
  db.setChannel(channel.id, { hidden: true });
  return 'ð Channel hidden from everyone else.';
}

async function unhideChannel(member) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { ViewChannel: null });
  db.setChannel(channel.id, { hidden: false });
  return 'ðï¸ Channel is now visible to everyone.';
}

async function claimChannel(member) {
  const { channel, data } = getUserTempChannel(member);
  if (isOwner(member, data)) throw new VoiceActionError('You already own this channel.');

  const ownerStillPresent = channel.members.has(data.ownerId);
  if (ownerStillPresent) throw new VoiceActionError('The current owner is still in the channel.');

  // Strip old owner's elevated overwrite, grant new owner the same permissions.
  await channel.permissionOverwrites.delete(data.ownerId).catch(() => {});
  await channel.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    Stream: true,
    UseVAD: true,
    PrioritySpeaker: true,
    ManageChannels: true,
    MoveMembers: true,
    MuteMembers: true,
    DeafenMembers: true,
  });

  db.setChannel(channel.id, { ownerId: member.id });
  return `ð <@${member.id}> is now the owner of this channel.`;
}

async function transferChannel(member, targetMember) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);

  if (!targetMember) throw new VoiceActionError('Please mention a valid member to transfer ownership to.');
  if (targetMember.id === member.id) throw new VoiceActionError('You already own this channel.');
  if (!channel.members.has(targetMember.id)) {
    throw new VoiceActionError('That user must be in your voice channel to receive ownership.');
  }

  await channel.permissionOverwrites.delete(member.id).catch(() => {});
  await channel.permissionOverwrites.edit(targetMember.id, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    Stream: true,
    UseVAD: true,
    PrioritySpeaker: true,
    ManageChannels: true,
    MoveMembers: true,
    MuteMembers: true,
    DeafenMembers: true,
  });

  db.setChannel(channel.id, { ownerId: targetMember.id });
  return `âï¸ Ownership transferred to <@${targetMember.id}>.`;
}

async function permitUser(member, targetMember) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  if (!targetMember) throw new VoiceActionError('Please mention a valid member to trust.');

  await channel.permissionOverwrites.edit(targetMember.id, { Connect: true, ViewChannel: true });

  const permitted = new Set(data.permitted || []);
  permitted.add(targetMember.id);
  const rejected = (data.rejected || []).filter((id) => id !== targetMember.id);
  db.setChannel(channel.id, { permitted: [...permitted], rejected });

  return `ð¤ <@${targetMember.id}> is now trusted and can join even when locked.`;
}

async function rejectUser(member, targetMember) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  if (!targetMember) throw new VoiceActionError('Please mention a valid member to reject.');
  if (targetMember.id === member.id) throw new VoiceActionError('You cannot reject yourself.');

  await channel.permissionOverwrites.edit(targetMember.id, { Connect: false, ViewChannel: false });

  const rejected = new Set(data.rejected || []);
  rejected.add(targetMember.id);
  const permitted = (data.permitted || []).filter((id) => id !== targetMember.id);
  db.setChannel(channel.id, { rejected: [...rejected], permitted });

  // Disconnect them immediately if they're currently inside.
  const targetVoiceMember = channel.members.get(targetMember.id);
  if (targetVoiceMember) {
    await targetVoiceMember.voice.disconnect('Rejected by channel owner.').catch(() => {});
  }

  return `ð« <@${targetMember.id}> has been blocked from this channel.`;
}

async function kickUser(member, targetMember) {
  const { channel, data } = getUserTempChannel(member);
  requireOwner(member, data);
  if (!targetMember) throw new VoiceActionError('Please mention a valid member to disconnect.');
  if (targetMember.id === member.id) throw new VoiceActionError('You cannot disconnect yourself.');

  const targetVoiceMember = channel.members.get(targetMember.id);
  if (!targetVoiceMember) throw new VoiceActionError('That user is not currently in your channel.');

  await targetVoiceMember.voice.disconnect('Disconnected by channel owner.').catch(() => {});
  return `ð· <@${targetMember.id}> has been disconnected from the channel.`;
}

module.exports = {
  VoiceActionError,
  getUserTempChannel,
  isOwner,
  requireOwner,
  createTempChannel,
  cleanupIfEmpty,
  renameChannel,
  setLimit,
  lockChannel,
  unlockChannel,
  hideChannel,
  unhideChannel,
  claimChannel,
  transferChannel,
  permitUser,
  rejectUser,
  kickUser,
};
