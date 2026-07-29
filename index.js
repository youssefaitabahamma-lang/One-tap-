require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// ---- Keep-alive web server (for Replit) ----
// This gives the bot an HTTP endpoint that an uptime pinger (or Replit's
// "Always On" deployment) can hit to help prevent the repl from sleeping.
// See the README for why this alone does not guarantee 24/7 uptime on
// Replit's free tier.
const app = express();
app.get('/', (req, res) => {
  res.send('OneTap bot is running.');
});
app.listen(process.env.PORT || 3000, () => {
  console.log('[KeepAlive] Web server listening — ping this URL to help prevent sleeping.');
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

// ---- Dynamically load every event in src/events ----
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[Loader] Loaded event: ${event.name}`);
}

client.on('error', (err) => console.error('[Client Error]', err));
process.on('unhandledRejection', (err) => console.error('[Unhandled Rejection]', err));

if (!process.env.TOKEN) {
  console.error('Missing TOKEN in your .env file. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

client.login(process.env.TOKEN);
