const { Events, ActivityType } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[${config.botName}] Logged in as ${client.user.tag} (${client.guilds.cache.size} guild(s))`);
    client.user.setPresence({
      activities: [{ name: `${config.prefix} help | OneTap`, type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
