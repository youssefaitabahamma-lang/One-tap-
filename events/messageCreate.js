const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const db = require('../database');
const { runSetup } = require('../commands/setup');
const { buildInfoEmbed, buildHelpEmbed } = require('../utils/embeds');
const tc = require('../utils/tempChannel');

function errorEmbed(message) {
  return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${message}`);
}

function successEmbed(message) {
  return new EmbedBuilder().setColor(config.successColor).setDescription(message);
}

function resolveTargetMember(message, args) {
  const mentioned = message.mentions.members?.first();
  if (mentioned) return mentioned;
  const idArg = args.find((a) => /^\d{15,25}$/.test(a));
  if (idArg) return message.guild.members.cache.get(idArg) ?? null;
  return null;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.toLowerCase().startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const sub = (args.shift() || '').toLowerCase();

    try {
      switch (sub) {
        case 'setup': {
          if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return void message.reply({ embeds: [errorEmbed('You need the **Manage Server** permission to run setup.')] });
          }
          const existing = db.getGuildConfig(message.guild.id);
          if (existing && message.guild.channels.cache.has(existing.jtcChannelId)) {
            return void message.reply({ embeds: [errorEmbed('OneTap is already set up in this server.')] });
          }
          await message.reply({ embeds: [successEmbed('⚙️ Setting up OneTap... this may take a few seconds.')] });
          const { interfaceChannel } = await runSetup(message.guild);
          await message.channel.send({ embeds: [successEmbed(`✅ Setup complete! Head to ${interfaceChannel} to see your control panel.`)] });
          break;
        }

        case 'name':
        case 'rename': {
          const newName = args.join(' ');
          const msg = await tc.renameChannel(message.member, newName);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'limit': {
          const msg = await tc.setLimit(message.member, args[0]);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'lock': {
          const msg = await tc.lockChannel(message.member);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'unlock': {
          const msg = await tc.unlockChannel(message.member);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'hide': {
          const msg = await tc.hideChannel(message.member);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'unhide': {
          const msg = await tc.unhideChannel(message.member);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'perm':
        case 'trust': {
          const target = resolveTargetMember(message, args);
          const msg = await tc.permitUser(message.member, target);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'reject':
        case 'block': {
          const target = resolveTargetMember(message, args);
          const msg = await tc.rejectUser(message.member, target);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'kick':
        case 'disconnect': {
          const target = resolveTargetMember(message, args);
          const msg = await tc.kickUser(message.member, target);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'claim': {
          const msg = await tc.claimChannel(message.member);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'transfer': {
          const target = resolveTargetMember(message, args);
          const msg = await tc.transferChannel(message.member, target);
          await message.reply({ embeds: [successEmbed(msg)] });
          break;
        }

        case 'info': {
          const { channel, data } = tc.getUserTempChannel(message.member);
          await message.reply({ embeds: [buildInfoEmbed(channel, data, message.guild)] });
          break;
        }

        case 'help': {
          await message.reply({ embeds: [buildHelpEmbed(message.guild)] });
          break;
        }

        default: {
          await message.reply({ embeds: [errorEmbed(`Unknown command. Try \`${config.prefix} help\` for a list of commands.`)] });
        }
      }
    } catch (err) {
      if (err instanceof tc.VoiceActionError) {
        await message.reply({ embeds: [errorEmbed(err.message)] });
      } else {
        console.error('[messageCreate] Unexpected error:', err);
        await message.reply({ embeds: [errorEmbed('Something went wrong running that command.')] });
      }
    }
  },
};
