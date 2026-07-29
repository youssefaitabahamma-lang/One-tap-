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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Memory Cache Systems
client.voiceOwners = new Map();
client.voiceCategory = null;
client.voiceCreator = null;
client.voicePanel = null;

// Register Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup the One Tap Voice interface & panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Successfully registered /setup command!");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
});

// ==========================================
// 1. SETUP COMMAND HANDLER (/setup)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "setup") return;

  try {
    const guild = interaction.guild;

    // Create Category
    const category = await guild.channels.create({
      name: "🎤 ONE TAP VOICE",
      type: ChannelType.GuildCategory
    });

    // Create "Join to Create" Voice Channel
    const creator = await guild.channels.create({
      name: "➕ Join to Create",
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    // Create Text Channel for Voice Control Panel
    const panelChannel = await guild.channels.create({
      name: "🎛️-voice-panel",
      type: ChannelType.GuildText,
      parent: category.id
    });

    // Save IDs in Bot Client
    client.voiceCategory = category.id;
    client.voiceCreator = creator.id;
    client.voicePanel = panelChannel.id;

    // Embed Design for Control Panel
    const panelEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎤 Voice Control Panel")
      .setDescription("Join your custom voice channel first, then use the buttons below to manage your room!")
      .setThumbnail(guild.iconURL({ dynamic: true }) || "https://cdn.discordapp.com/embed/avatars/0.png")
      .setFooter({ text: `${guild.name} • Voice Management`, iconURL: guild.iconURL() });

    // Buttons Rows
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_lock").setLabel("Lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_unlock").setLabel("Unlock").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_rename").setLabel("Rename").setEmoji("✏️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("v_limit").setLabel("Limit").setEmoji("👥").setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_claim").setLabel("Claim").setEmoji("👑").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_kick").setLabel("Kick").setEmoji("👢").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("v_transfer").setLabel("Transfer").setEmoji("🔀").setStyle(ButtonStyle.Primary)
    );

    await panelChannel.send({
      embeds: [panelEmbed],
      components: [row1, row2]
    });

    await interaction.reply({
      content: "✅ One Tap Voice system & panel have been setup successfully!",
      ephemeral: true
    });

  } catch (err) {
    console.error("Setup Error:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Failed to setup the voice system.",
        ephemeral: true
      });
    }
  }
});

// ==========================================
// 2. DYNAMIC VOICE CHANNEL CREATION & DELETION
// ==========================================
client.on("voiceStateUpdate", async (oldState, newState) => {
  // Joined "Join to Create"
  if (newState.channelId && newState.channelId === client.voiceCreator) {
    const member = newState.member;
    try {
      // Create Channel (Only Username, No Emoji)
      const channel = await member.guild.channels.create({
        name: `${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: client.voiceCategory,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect]
          }
        ]
      });

      // Track channel owner
      client.voiceOwners.set(channel.id, member.id);

      // Move User
      await member.voice.setChannel(channel);

    } catch (err) {
      console.error("Error creating dynamic voice channel:", err);
    }
  }

  // Handle Member Leaving Channels (Transfer Owner or Auto-delete)
  if (oldState.channel && client.voiceOwners.has(oldState.channel.id)) {
    const channel = oldState.channel;
    const ownerId = client.voiceOwners.get(channel.id);

    // If channel is completely empty -> Delete
    if (channel.members.size === 0) {
      client.voiceOwners.delete(channel.id);
      await channel.delete().catch(() => {});
      return;
    }

    // If Owner leaves, transfer ownership to the next remaining member
    if (oldState.member.id === ownerId) {
      const nextOwner = channel.members.first();
      if (nextOwner) {
        client.voiceOwners.set(channel.id, nextOwner.id);
      } else {
        client.voiceOwners.delete(channel.id);
        await channel.delete().catch(() => {});
      }
    }
  }
});

// ==========================================
// 3. INTERACTION HANDLER (BUTTONS & MODALS)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  // --- BUTTON INTERACTIONS ---
  if (interaction.isButton()) {
    const channel = interaction.member.voice?.channel;

    if (!channel) {
      return interaction.reply({ content: "❌ You must be inside your voice channel.", ephemeral: true });
    }

    if (!client.voiceOwners.has(channel.id)) {
      return interaction.reply({ content: "❌ This is not a managed voice channel.", ephemeral: true });
    }

    const currentOwner = client.voiceOwners.get(channel.id);

    // --- CLAIM ACTION ---
    if (interaction.customId === "v_claim") {
      if (currentOwner && channel.members.has(currentOwner)) {
        return interaction.reply({ content: "❌ The room owner is still inside the voice channel.", ephemeral: true });
      }
      client.voiceOwners.set(channel.id, interaction.user.id);
      return interaction.reply({ content: "👑 You are now the owner of this room!", ephemeral: true });
    }

    // --- ONLY OWNER CAN USE OTHER BUTTONS ---
    if (currentOwner !== interaction.user.id) {
      return interaction.reply({ content: "❌ Only the room owner can use this control.", ephemeral: true });
    }

    // Lock Channel
    if (interaction.customId === "v_lock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      return interaction.reply({ content: "🔒 Voice channel locked.", ephemeral: true });
    }

    // Unlock Channel
    if (interaction.customId === "v_unlock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      return interaction.reply({ content: "🔓 Voice channel unlocked.", ephemeral: true });
    }

    // Rename Modal
    if (interaction.customId === "v_rename") {
      const modal = new ModalBuilder().setCustomId("m_rename").setTitle("Rename Voice Channel");
      const input = new TextInputBuilder()
        .setCustomId("v_name_input")
        .setLabel("New Channel Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // Limit Modal
    if (interaction.customId === "v_limit") {
      const modal = new ModalBuilder().setCustomId("m_limit").setTitle("Set Voice Limit");
      const input = new TextInputBuilder()
        .setCustomId("v_limit_input")
        .setLabel("Enter Limit Number (0-99)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // Kick Action
    if (interaction.customId === "v_kick") {
      const target = channel.members.filter(m => !m.user.bot && m.id !== interaction.user.id).first();
      if (!target) {
        return interaction.reply({ content: "❌ No other members to kick.", ephemeral: true });
      }
      await target.voice.disconnect();
      return interaction.reply({ content: `👢 **${target.user.username}** was kicked from the channel.`, ephemeral: true });
    }

    // Transfer Action
    if (interaction.customId === "v_transfer") {
      const target = channel.members.filter(m => !m.user.bot && m.id !== interaction.user.id).first();
      if (!target) {
        return interaction.reply({ content: "❌ No members available to transfer ownership to.", ephemeral: true });
      }
      client.voiceOwners.set(channel.id, target.id);
      return interaction.reply({ content: `🔄 Ownership transferred to **${target.user.username}**.`, ephemeral: true });
    }
  }

  // --- MODAL SUBMIT HANDLERS ---
  if (interaction.isModalSubmit()) {
    const channel = interaction.member.voice?.channel;

    if (!channel || client.voiceOwners.get(channel.id) !== interaction.user.id) {
      return interaction.reply({ content: "❌ Action failed. You must be in your owned channel.", ephemeral: true });
    }

    if (interaction.customId === "m_rename") {
      const newName = interaction.fields.getTextInputValue("v_name_input").trim();
      await channel.setName(newName);
      return interaction.reply({ content: `✏️ Channel renamed to: **${newName}**`, ephemeral: true });
    }

    if (interaction.customId === "m_limit") {
      const limitVal = parseInt(interaction.fields.getTextInputValue("v_limit_input"));
      if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
        return interaction.reply({ content: "❌ Please enter a valid number between 0 and 99.", ephemeral: true });
      }
      await channel.setUserLimit(limitVal);
      return interaction.reply({ content: `👥 Channel limit updated to: **${limitVal}**`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
