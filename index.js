const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Voice System
client.voiceOwners = new Map();
client.voiceCreator = null;
client.panelChannel = null;
client.logsChannel = null;

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "setup") return;

  try {

    const category = await interaction.guild.channels.create({
      name: "🎤 ONE TAP VOICE",
      type: ChannelType.GuildCategory
    });

    const creator = await interaction.guild.channels.create({
      name: "➕ Join to Create",
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    const panel = await interaction.guild.channels.create({
      name: "🎛️-voice-panel",
      type: ChannelType.GuildText,
      parent: category.id
    });

    client.voiceCategory = category.id;
    client.voiceCreator = creator.id;
    client.voicePanel = panel.id;

    await interaction.reply({
      content: "✅ One Tap Voice has been setup successfully!",
      ephemeral: true
    });

  } catch (err) {

    console.error(err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Failed to setup the voice system.",
        ephemeral: true
      });
    }

  }

});
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (!client.voiceCreator) return;

  if (newState.channelId !== client.voiceCreator) return;

  const member = newState.member;

  try {

    const channel = await member.guild.channels.create({
      name: `🔊 ${member.user.username}'s Room`,
      type: ChannelType.GuildVoice,
      parent: client.voiceCategory
    });

    client.voiceOwners.set(channel.id, member.id);

    await member.voice.setChannel(channel);

  } catch (err) {
    console.error(err);
  }

  if (
    oldState.channel &&
    oldState.channel.id !== client.voiceCreator &&
    oldState.channel.members.size === 0
  ) {

    client.voiceOwners.delete(oldState.channel.id);

    await oldState.channel.delete().catch(() => {});

  }

});
client.once("ready", async () => {

  client.on("voiceStateUpdate", async (oldState, newState) => {

    if (!client.voiceCreator) return;
    if (newState.channelId !== client.voiceCreator) return;

    const panel = newState.guild.channels.cache.get(client.voicePanel);

    if (!panel) return;

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎤 Voice Control")
      .setDescription("Use the buttons below to manage your voice channel.")
      .setThumbnail(newState.guild.iconURL({ dynamic: true }));

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("lock")
        .setLabel("Lock")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("unlock")
        .setLabel("Unlock")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("rename")
        .setLabel("Rename")
        .setEmoji("✏️")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("limit")
        .setLabel("Limit")
        .setEmoji("👥")
        .setStyle(ButtonStyle.Success)
    );

    await panel.send({
      embeds: [embed],
      components: [row1]
    });

  });

});
const panel = await interaction.guild.channels.create({
  name: "🎛️-voice-panel",
  type: ChannelType.GuildText,
  parent: category.id
});

client.voiceCategory = category.id;
client.voiceCreator = creator.id;
client.voicePanel = panel.id;

const embed = new EmbedBuilder()
  .setColor("#5865F2")
  .setTitle("🎤 Voice Control Panel")
  .setDescription("Join your voice channel first, then use the buttons below.")
  .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("lock")
    .setLabel("Lock")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Secondary),

  new ButtonBuilder()
    .setCustomId("unlock")
    .setLabel("Unlock")
    .setEmoji("🔓")
    .setStyle(ButtonStyle.Secondary),

  new ButtonBuilder()
    .setCustomId("rename")
    .setLabel("Rename")
    .setEmoji("✏️")
    .setStyle(ButtonStyle.Primary),

  new ButtonBuilder()
    .setCustomId("limit")
    .setLabel("Limit")
    .setEmoji("👥")
    .setStyle(ButtonStyle.Success)
);

await panel.send({
  embeds: [embed],
  components: [row]
});
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  const channel = interaction.member.voice.channel;

  if (!channel) {
    return interaction.reply({
      content: "❌ You must be in a voice channel.",
      ephemeral: true
    });
  }

  if (!client.voiceOwners.has(channel.id)) {
    return interaction.reply({
      content: "❌ This is not a managed voice channel.",
      ephemeral: true
    });
  }

  const owner = client.voiceOwners.get(channel.id);

  if (owner !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Only the room owner can use this panel.",
      ephemeral: true
    });
  }

  switch (interaction.customId) {

    case "lock":

      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { Connect: false }
      );

      return interaction.reply({
        content: "🔒 Voice channel locked.",
        ephemeral: true
      });

    case "unlock":

      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { Connect: true }
      );

      return interaction.reply({
        content: "🔓 Voice channel unlocked.",
        ephemeral: true
      });

  }

});
client.on("interactionCreate", async (interaction) => {

  // =========================
  // BUTTONS
  // =========================
  if (interaction.isButton()) {

    if (
      interaction.customId !== "rename" &&
      interaction.customId !== "limit"
    ) return;

    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply({
        content: "❌ You must be in a voice channel.",
        ephemeral: true
      });
    }

    if (!client.voiceOwners.has(channel.id)) {
      return interaction.reply({
        content: "❌ This is not a managed voice channel.",
        ephemeral: true
      });
    }

    if (client.voiceOwners.get(channel.id) !== interaction.user.id) {
      return interaction.reply({
        content: "❌ Only the room owner can use this.",
        ephemeral: true
      });
    }

    if (interaction.customId === "rename") {

      const modal = new ModalBuilder()
        .setCustomId("rename_modal")
        .setTitle("Rename Voice Channel");

      const input = new TextInputBuilder()
        .setCustomId("voice_name")
        .setLabel("New Channel Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);

    }

    if (interaction.customId === "limit") {

      const modal = new ModalBuilder()
        .setCustomId("limit_modal")
        .setTitle("Voice Limit");

      const input = new TextInputBuilder()
        .setCustomId("voice_limit")
        .setLabel("Enter a number (0-99)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );

      return interaction.showModal(modal);

    }

  }

  // =========================
  // MODALS
  // =========================
  if (interaction.isModalSubmit()) {

    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply({
        content: "❌ You must be in a voice channel.",
        ephemeral: true
      });
    }

    if (!client.voiceOwners.has(channel.id)) {
      return interaction.reply({
        content: "❌ This is not a managed voice channel.",
        ephemeral: true
      });
    }

    if (client.voiceOwners.get(channel.id) !== interaction.user.id) {
      return interaction.reply({
        content: "❌ Only the room owner can use this.",
        ephemeral: true
      });
    }

    if (interaction.customId === "rename_modal") {

      const newName =
        interaction.fields.getTextInputValue("voice_name").trim();

      if (newName.length < 2 || newName.length > 100) {
        return interaction.reply({
          content: "❌ Name must be between 2 and 100 characters.",
          ephemeral: true
        });
      }

      await channel.setName(newName);

      return interaction.reply({
        content: `✏️ Channel renamed to **${newName}**`,
        ephemeral: true
      });

    }

    if (interaction.customId === "limit_modal") {

      const limit = Number(
        interaction.fields.getTextInputValue("voice_limit")
      );

      if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        return interaction.reply({
          content: "❌ Enter a valid number (0-99).",
          ephemeral: true
        });
      }

      await channel.setUserLimit(limit);

      return interaction.reply({
        content: `👥 User limit set to **${limit}**`,
        ephemeral: true
      });

    }

  }

});
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  const channel = interaction.member.voice.channel;

  if (!channel) {
    return interaction.reply({
      content: "❌ You must be in a voice channel.",
      ephemeral: true
    });
  }

  if (!client.voiceOwners.has(channel.id)) {
    return interaction.reply({
      content: "❌ This is not a managed voice channel.",
      ephemeral: true
    });
  }

  const owner = client.voiceOwners.get(channel.id);

  // =========================
  // CLAIM
  // =========================
  if (interaction.customId === "claim") {

    if (owner && channel.members.has(owner)) {
      return interaction.reply({
        content: "❌ The room owner is still in the voice channel.",
        ephemeral: true
      });
    }

    client.voiceOwners.set(channel.id, interaction.user.id);

    return interaction.reply({
      content: "👑 You are now the room owner.",
      ephemeral: true
    });

  }

  // =========================
  // OWNER CHECK
  // =========================
  if (owner !== interaction.user.id) {
    return interaction.reply({
      content: "❌ Only the room owner can use this.",
      ephemeral: true
    });
  }

  // =========================
  // KICK
  // =========================
  if (interaction.customId === "kick") {

    const target = channel.members
      .filter(m => !m.user.bot && m.id !== interaction.user.id)
      .first();

    if (!target) {
      return interaction.reply({
        content: "❌ No members to kick.",
        ephemeral: true
      });
    }

    await target.voice.disconnect();

    return interaction.reply({
      content: `👢 ${target.user.username} was kicked from the voice channel.`,
      ephemeral: true
    });

  }

  // =========================
  // TRANSFER
  // =========================
  if (interaction.customId === "transfer") {

    const target = channel.members
      .filter(m => !m.user.bot && m.id !== interaction.user.id)
      .first();

    if (!target) {
      return interaction.reply({
        content: "❌ No members available.",
        ephemeral: true
      });
    }

    client.voiceOwners.set(channel.id, target.id);

    return interaction.reply({
      content: `🔄 Ownership transferred to ${target.user.username}.`,
      ephemeral: true
    });

  }

});
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (!oldState.channel) return;

  const channel = oldState.channel;

  if (!client.voiceOwners.has(channel.id)) return;

  const owner = client.voiceOwners.get(channel.id);

  // إذا خرج المالك
  if (oldState.member.id === owner) {

    const nextOwner = channel.members.first();

    if (nextOwner) {

      client.voiceOwners.set(channel.id, nextOwner.id);

      // Logs
      if (client.logsChannel) {

        const logChannel = client.channels.cache.get(client.logsChannel);

        if (logChannel) {
          await logChannel.send(
            `👑 ${nextOwner.user.tag} is now the owner of **${channel.name}**`
          ).catch(() => {});
        }

      }

    } else {

      client.voiceOwners.delete(channel.id);

      await channel.delete().catch(() => {});

      return;

    }

  }

  // حذف الروم إذا بقات خاوية
  if (
    channel.members.size === 0 &&
    client.voiceOwners.has(channel.id)
  ) {

    client.voiceOwners.delete(channel.id);

    await channel.delete().catch(() => {});

  }

});
