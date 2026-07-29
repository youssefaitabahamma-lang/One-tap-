const { Events } = require('discord.js');
const db = require('../database');
const { createTempChannel, cleanupIfEmpty } = require('../utils/tempChannel');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    const guildConfig = db.getGuildConfig(guild.id);
    if (!guildConfig) return; // OneTap not set up in this guild

    // ---- User joined the "Join to Create" channel ----
    if (newState.channelId && newState.channelId === guildConfig.jtcChannelId) {
      const jtcChannel = newState.channel;
      try {
        await createTempChannel(newState.member, jtcChannel, guildConfig);
      } catch (err) {
        console.error('[voiceStateUpdate] Failed to create temp channel:', err);
      }
    }

    // ---- User left a channel: check if it's now an empty temp channel ----
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const leftChannel = oldState.channel;
      if (leftChannel && db.getChannel(leftChannel.id)) {
        await cleanupIfEmpty(leftChannel);
      }
    }
  },
};
