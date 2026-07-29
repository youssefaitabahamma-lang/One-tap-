const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const config = require('../config');
const { buildControlPanelEmbed } = require('../utils/embeds');

/**
 * Runs the full OneTap setup for a guild:
 * 1. Creates (or reuses) the category.
 * 2. Creates the "Join to Create" voice channel.
 * 3. Creates the interface/control text channel right next to it.
 * 4. Posts the control panel embed with buttons.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{category, jtcChannel, interfaceChannel}>}
 */
async function runSetup(guild) {
  const category = await guild.channels.create({
    name: config.categoryName,
    type: ChannelType.GuildCategory,
  });

  const jtcChannel = await guild.channels.create({
    name: config.jtcChannelName,
    type: ChannelType.GuildVoice,
    parent: category.id,
  });

  const interfaceChannel = await guild.channels.create({
    name: config.interfaceChannelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel],
      },
    ],
  });

  const { embeds, components } = buildControlPanelEmbed(guild);
  const panelMessage = await interfaceChannel.send({ embeds, components });

  db.setGuildConfig(guild.id, {
    categoryId: category.id,
    jtcChannelId: jtcChannel.id,
    interfaceChannelId: interfaceChannel.id,
    panelMessageId: panelMessage.id,
  });

  return { category, jtcChannel, interfaceChannel };
}

module.exports = { runSetup };
