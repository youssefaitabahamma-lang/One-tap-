const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');
const { resolvePlaceholders } = require('./format');

/**
 * Builds the main control panel embed + button rows posted in the
 * interface channel during setup.
 */
function buildControlPanelEmbed(guild) {
  const banner = guild.bannerURL({ size: 1024 }) || guild.iconURL({ size: 1024 });

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`${config.botName} Interface`)
    .setDescription(
      resolvePlaceholders(
        `Welcome to OneTap {serverName}!\nUse the buttons below to manage your temporary voice channel.`,
        { guild }
      )
    )
    .setFooter({ text: `${config.botName} • Temporary Voice System`, iconURL: guild.client.user.displayAvatarURL() })
    .setTimestamp();

  if (banner) embed.setImage(banner);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc_rename').setEmoji('✏️').setLabel('Rename').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_lock').setEmoji('🔒').setLabel('Lock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_unlock').setEmoji('🔓').setLabel('Unlock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_hide').setEmoji('🙈').setLabel('Hide').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_unhide').setEmoji('👁️').setLabel('Unhide').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc_limit').setEmoji('👥').setLabel('User Limit').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_claim').setEmoji('👑').setLabel('Claim').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_transfer').setEmoji('↗️').setLabel('Transfer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_perm').setEmoji('👤').setLabel('Trust').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_reject').setEmoji('🚫').setLabel('Reject').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc_kick').setEmoji('🚷').setLabel('Disconnect').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vc_info').setEmoji('ℹ️').setLabel('Info').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

/**
 * Builds the "Info" embed for a temp voice channel.
 */
function buildInfoEmbed(channel, data, guild) {
  const owner = guild.members.cache.get(data.ownerId);
  const permitted = (data.permitted || []).map((id) => `<@${id}>`).join(', ') || 'None';
  const rejected = (data.rejected || []).map((id) => `<@${id}>`).join(', ') || 'None';

  return new EmbedBuilder()
    .setColor(config.infoColor)
    .setTitle(`ℹ️ ${channel.name} — Channel Info`)
    .addFields(
      { name: 'Owner', value: owner ? `${owner}` : 'Unknown (left)', inline: true },
      { name: 'Members', value: `${channel.members.size}`, inline: true },
      { name: 'User Limit', value: data.limit && data.limit > 0 ? `${data.limit}` : 'Unlimited', inline: true },
      { name: 'Locked', value: data.locked ? '🔒 Yes' : '🔓 No', inline: true },
      { name: 'Hidden', value: data.hidden ? '🙈 Yes' : '👁️ No', inline: true },
      { name: 'Trusted Users', value: permitted },
      { name: 'Rejected Users', value: rejected },
    )
    .setFooter({ text: `${config.botName} • Temporary Voice System` })
    .setTimestamp();
}

/**
 * Builds the .v help embed.
 */
function buildHelpEmbed(guild) {
  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(`${config.botName} Help — Voice Channel Commands`)
    .setDescription(
      resolvePlaceholders(
        `Manage your temporary voice channel using \`{prefix}\` commands or the buttons in the interface channel.`,
        { guild }
      ).replace('{prefix}', config.prefix)
    )
    .addFields(
      { name: `${config.prefix} setup`, value: 'Creates the OneTap category, join-to-create channel, and control panel. (Manage Server required)' },
      { name: `${config.prefix} name <new name>`, value: 'Renames your temporary voice channel.' },
      { name: `${config.prefix} limit <0-99>`, value: 'Sets the user limit for your channel (0 = unlimited).' },
      { name: `${config.prefix} lock`, value: 'Locks the channel so new members cannot connect.' },
      { name: `${config.prefix} unlock`, value: 'Unlocks the channel.' },
      { name: `${config.prefix} hide`, value: 'Hides the channel from everyone else.' },
      { name: `${config.prefix} unhide`, value: 'Makes the channel visible again.' },
      { name: `${config.prefix} perm @user`, value: 'Trusts a user, allowing them into a locked channel.' },
      { name: `${config.prefix} reject @user`, value: 'Blocks a user and disconnects them if present.' },
      { name: `${config.prefix} kick @user`, value: 'Disconnects a user from your channel without blocking them.' },
      { name: `${config.prefix} claim`, value: 'Claims ownership of the channel if the owner has left.' },
      { name: `${config.prefix} transfer @user`, value: 'Transfers ownership to another member currently in the channel.' },
      { name: `${config.prefix} info`, value: 'Shows detailed information about your current channel.' },
    )
    .setFooter({ text: `${config.botName} • Temporary Voice System` });
}

module.exports = { buildControlPanelEmbed, buildInfoEmbed, buildHelpEmbed };
