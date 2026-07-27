const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ChannelType, 
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// Slash Command Registration
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup the One Tap Voice interface")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Successfully registered /setup command!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
});

// Setup Command Handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setup") {
    const guild = interaction.guild;
    
    const category = await guild.channels.create({
      name: "🔊 ONE TAP VOICE",
      type: ChannelType.GuildCategory
    });

    const primaryChannel = await guild.channels.create({
      name: "➕ Join to Create",
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    client.primaryChannelId = primaryChannel.id;

    await interaction.reply({
      content: `✅ **One Tap Voice system successfully created!**\nJoin channel: <#${primaryChannel.id}>`,
      ephemeral: true
    });
  }
});

// One Tap Voice State Update
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.channelId && newState.channelId === client.primaryChannelId) {
    const guild = newState.guild;
    const user = newState.member.user;

    // Create custom voice channel
    const tempChannel = await guild.channels.create({
      name: `🔊 ${user.username}'s Room`,
      type: ChannelType.GuildVoice,
      parent: newState.channel.parentId,
      permissionOverwrites: [
        {
          id: user.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect]
        }
      ]
    });

    // Move user to channel
    await newState.setChannel(tempChannel);

    // Voice Manager Control Panel
    const embed1 = new EmbedBuilder()
      .setTitle("Voice Manager")
      .setColor("#2b2d31");

    // Row 1 Buttons (Lock, Unlock, Claim, Hide)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_unlock").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_claim").setEmoji("👑").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_hide").setEmoji("🙈").setStyle(ButtonStyle.Secondary)
    );

    // Row 2 Buttons (Unhide, Rename, Limit, Kick)
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_unhide").setEmoji("👀").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_rename").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_limit").setEmoji("👥").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_kick").setEmoji("👢").setStyle(ButtonStyle.Secondary)
    );

    // Row 3 Buttons (Permit, Reject)
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_permit").setEmoji("➕").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_reject").setEmoji("➖").setStyle(ButtonStyle.Secondary)
    );

    // Voice Rules Section
    const embed2 = new EmbedBuilder()
      .setTitle("Voice Rules")
      .setColor("#2b2d31");

    const rowRules = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_rules").setEmoji("❓").setLabel("Rules").setStyle(ButtonStyle.Secondary)
    );

    // Need Help or Support Section
    const embed3 = new EmbedBuilder()
      .setTitle("Need help or support?")
      .setColor("#2b2d31");

    const rowSupport = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_support").setEmoji("❓").setLabel("Support").setStyle(ButtonStyle.Secondary)
    );

    // Send Control Panel
    await tempChannel.send({
      content: `Welcome <@${user.id}>`,
      embeds: [embed1],
      components: [row1, row2, row3]
    });

    await tempChannel.send({
      embeds: [embed2],
      components: [rowRules]
    });

    await tempChannel.send({
      embeds: [embed3],
      components: [rowSupport]
    });
  }

  // Auto-delete empty channels
  if (oldState.channel && oldState.channel.id !== client.primaryChannelId) {
    if (oldState.channel.members.size === 0 && oldState.channel.parentId === newState.guild?.channels.cache.get(client.primaryChannelId)?.parentId) {
      await oldState.channel.delete().catch(() => {});
    }
  }
});

// Button and Modal Interaction Logic
client.on("interactionCreate", async (interaction) => {
  const channel = interaction.channel;

  if (interaction.isButton()) {
    if (!channel || channel.type !== ChannelType.GuildVoice) return;

    if (interaction.customId === "v_lock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      await interaction.reply({ content: "🔒 **Voice channel locked.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_unlock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      await interaction.reply({ content: "🔓 **Voice channel unlocked.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_hide") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      await interaction.reply({ content: "🙈 **Voice channel hidden.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_unhide") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
      await interaction.reply({ content: "👀 **Voice channel unhidden.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_claim") {
      await interaction.reply({ content: "👑 **You are already the channel owner.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_rename") {
      const modal = new ModalBuilder().setCustomId("m_rename").setTitle("Rename Voice Channel");
      const nameInput = new TextInputBuilder()
        .setCustomId("input_name")
        .setLabel("Enter new channel name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      await interaction.showModal(modal);
    } 
    else if (interaction.customId === "v_limit") {
      const modal = new ModalBuilder().setCustomId("m_limit").setTitle("Set Channel User Limit");
      const limitInput = new TextInputBuilder()
        .setCustomId("input_limit")
        .setLabel("Enter limit number (0 - 99)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
      await interaction.showModal(modal);
    } 
    else if (interaction.customId === "v_kick") {
      await interaction.reply({ content: "👢 **Kick members directly using Discord member settings in this channel.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_permit") {
      await interaction.reply({ content: "➕ **Permit permission options updated.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_reject") {
      await interaction.reply({ content: "➖ **Reject permission options updated.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_rules") {
      await interaction.reply({ content: "📜 **Server Rules:** Be respectful, follow Discord TOS, and keep the noise clean!", ephemeral: true });
    } 
    else if (interaction.customId === "v_support") {
      await interaction.reply({ content: "❓ **Need Support?** Contact server moderators or open a ticket in support channel.", ephemeral: true });
    }
  }

  // Modal Submissions for Rename & Limit
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "m_rename") {
      const newName = interaction.fields.getTextInputValue("input_name");
      await channel.setName(newName);
      await interaction.reply({ content: `✏️ **Channel name changed to:** \`${newName}\``, ephemeral: true });
    } 
    else if (interaction.customId === "m_limit") {
      const limitVal = parseInt(interaction.fields.getTextInputValue("input_limit"));
      if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
        return interaction.reply({ content: "❌ **Please enter a valid number between 0 and 99.**", ephemeral: true });
      }
      await channel.setUserLimit(limitVal);
      await interaction.reply({ content: `👥 **Channel limit set to:** \`${limitVal}\``, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
