const config = require('../config');

/**
 * Resolves {botName} / {serverName} / {username} placeholders inside a string.
 * @param {string} str
 * @param {{guild?: import('discord.js').Guild, member?: import('discord.js').GuildMember}} ctx
 */
function resolvePlaceholders(str, ctx = {}) {
  return str
    .replace(/{botName}/g, config.botName)
    .replace(/{serverName}/g, ctx.guild?.name ?? 'this server')
    .replace(/{username}/g, ctx.member?.displayName ?? ctx.member?.user?.username ?? 'User');
}

module.exports = { resolvePlaceholders };
