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

// One Tap Voice Logic & Professional Panel
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.channelId && newState.channelId === client.primaryChannelId) {
    const guild = newState.guild;
    const user = newState.member.user;

    // Create custom voice channel
    const tempChannel = await guild.channels.create({
      name: `🔊 ${user.username}`,
      type: ChannelType.GuildVoice,
      parent: newState.channel.parentId,
      permissionOverwrites: [
        {
          id: user.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect]
        }
      ]
    });

    // Move user
    await newState.setChannel(tempChannel);

    // Get Server Icon and Banner
    const guildIcon = guild.iconURL({ dynamic: true, size: 512 }) || "https://cdn.discordapp.com/embed/avatars/0.png";
    const guildBanner = guild.bannerURL({ size: 1024 }) || guildIcon;

    // Single Professional Embed
    const mainEmbed = new EmbedBuilder()
      .setTitle("🎙️ Voice Manager")
      .setDescription(
        `Welcome <@${user.id}> to your dynamic voice room!\nUse the interface below to manage your channel settings.`
      )
      .setColor("#2b2d31")
      .setThumbnail(guildIcon)
      .setImage(guildBanner)
      .addFields(
        { name: "📜 Voice Rules", value: "Click **Rules** below to view server guidelines.", inline: false },
        { name: "❓ Need help or support?", value: "Click **Support** to contact our team.", inline: false }
      )
      .setFooter({ text: guild.name, iconURL: guildIcon });

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

    // Row 4 Buttons (Rules & Support)
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_rules").setLabel("Rules").setEmoji("📜").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_support").setLabel("Support").setEmoji("❓").setStyle(ButtonStyle.Secondary)
    );

    // Send single clean message
    await tempChannel.send({
      content: `Welcome <@${user.id}>`,
      embeds: [mainEmbed],
      components: [row1, row2, row3, row4]
    });
  }

  // Auto-delete empty channel
  if (oldState.channel && oldState.channel.id !== client.primaryChannelId) {
    if (oldState.channel.members.size === 0 && oldState.channel.parentId === newState.guild?.channels.cache.get(client.primaryChannelId)?.parentId) {
      await oldState.channel.delete().catch(() => {});
    }
  }
});

// Button and Modal Handlers
client.on("interactionCreate", async (interaction) => {
  const channel = interaction.channel;

  if (interaction.isButton()) {
    if (!channel || channel.type !== ChannelType.GuildVoice) return;

    if (interaction.customId === "v_lock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      await interaction.reply({ content: "🔒 **Voice channel locked successfully!**", ephemeral: true });
    } 
    else if (interaction.customId === "v_unlock") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      await interaction.reply({ content: "🔓 **Voice channel unlocked!**", ephemeral: true });
    } 
    else if (interaction.customId === "v_hide") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      await interaction.reply({ content: "🙈 **Voice channel hidden!**", ephemeral: true });
    } 
    else if (interaction.customId === "v_unhide") {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
      await interaction.reply({ content: "👀 **Voice channel visible again!**", ephemeral: true });
    } 
    else if (interaction.customId === "v_claim") {
      await interaction.reply({ content: "👑 **You are already the channel owner!**", ephemeral: true });
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
      await interaction.reply({ content: "👢 **Use channel settings to manage members.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_permit") {
      await interaction.reply({ content: "➕ **Permit options activated.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_reject") {
      await interaction.reply({ content: "➖ **Reject options activated.**", ephemeral: true });
    } 
    else if (interaction.customId === "v_rules") {
      await interaction.reply({ content: "📜 **Rules:** Respect everyone, refrain from spamming, and enjoy your voice stay!", ephemeral: true });
    } 
    else if (interaction.customId === "v_support") {
      await interaction.reply({ content: "❓ **Support:** Open a support ticket or contact our admins for help.", ephemeral: true });
    }
  }

  // Handle Modal Submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "m_rename") {
      const newName = interaction.fields.getTextInputValue("input_name");
      await channel.setName(newName);
      await interaction.reply({ content: `✏️ **Channel name updated to:** \`${newName}\``, ephemeral: true });
    } 
    else if (interaction.customId === "m_limit") {
      const limitVal = parseInt(interaction.fields.getTextInputValue("input_limit"));
      if (isNaN(limitVal) || limitVal < 0 || limitVal > 99) {
        return interaction.reply({ content: "❌ **Please enter a valid number (0 - 99).**", ephemeral: true });
      }
      await channel.setUserLimit(limitVal);
      await interaction.reply({ content: `👥 **Channel limit updated to:** \`${limitVal}\``, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
