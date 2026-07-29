/**
 * Central configuration file.
 * {botName} and {serverName} placeholders used throughout embeds/messages
 * are resolved at runtime via utils/format.js -> resolvePlaceholders().
 */
module.exports = {
  botName: 'OneTap',
  prefix: '.v',

  // Visual
  embedColor: 0x2b2d31,
  successColor: 0x57f287,
  errorColor: 0xed4245,
  infoColor: 0x5865f2,

  // Channel naming
  categoryName: '🔊 OneTap Channels',
  jtcChannelName: '➕ Join to Create',
  interfaceChannelName: '🎛│voice-interface',
  defaultChannelName: "{username}'s Channel",

  // Behavior
  deleteEmptyChannelDelayMs: 2000, // small grace period to avoid race-condition flicker
};
