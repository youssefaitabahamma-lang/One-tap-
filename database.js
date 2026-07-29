/**
 * Lightweight JSON file "database".
 *
 * Structure:
 * {
 *   guilds: {
 *     [guildId]: { categoryId, jtcChannelId, interfaceChannelId, panelMessageId }
 *   },
 *   channels: {
 *     [channelId]: {
 *       guildId,
 *       ownerId,
 *       locked: boolean,
 *       hidden: boolean,
 *       limit: number,       // 0 = unlimited
 *       permitted: [userId], // users explicitly allowed through a lock
 *       rejected: [userId],  // users explicitly blocked
 *       createdAt: number
 *     }
 *   }
 * }
 *
 * Swap this module out for a real database (Mongo/Postgres/Redis) in production
 * by keeping the same method signatures.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

class Database {
  constructor() {
    this.data = { guilds: {}, channels: {} };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        this.data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        this.data.guilds ??= {};
        this.data.channels ??= {};
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[Database] Failed to load db.json, starting with a fresh store.', err);
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[Database] Failed to persist db.json', err);
    }
  }

  // ---------- Guild config ----------
  getGuildConfig(guildId) {
    return this.data.guilds[guildId] || null;
  }

  setGuildConfig(guildId, config) {
    this.data.guilds[guildId] = { ...(this.data.guilds[guildId] || {}), ...config };
    this.save();
  }

  // ---------- Temp channel state ----------
  getChannel(channelId) {
    return this.data.channels[channelId] || null;
  }

  setChannel(channelId, data) {
    this.data.channels[channelId] = { ...(this.data.channels[channelId] || {}), ...data };
    this.save();
  }

  deleteChannel(channelId) {
    delete this.data.channels[channelId];
    this.save();
  }

  getAllChannels() {
    return this.data.channels;
  }
}

module.exports = new Database();
