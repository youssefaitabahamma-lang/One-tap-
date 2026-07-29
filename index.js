require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

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
