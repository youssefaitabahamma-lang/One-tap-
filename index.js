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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // ضروري لتمكين قراءة الرسائل
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

// Voice State Update (Dynamic Channel Creation)
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.channelId && newState.channelId === client.primaryChannelId) {
    const guild = newState.guild;
    const user = newState.member.user;

    // Create channel
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

    // Move User
    await newState.setChannel(tempChannel);

    const serverBanner = guild.bannerURL({ size: 1024 }) || guild.iconURL({ dynamic: true, size: 1024 }) || "https://cdn.discordapp.com/embed/avatars/0.png";

    const mainEmbed = new EmbedBuilder()
      .setTitle(`${guild.name} Interface`)
      .setDescription("Use the buttons below or commands starting with `.v` to manage your voice channel.")
      .setColor("#ffcc00")
      .setImage(serverBanner);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_rename").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_unlock").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_hide").setEmoji("🙈").setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_unhide").setEmoji("👀").setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_video").setEmoji("🎥").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_music").setEmoji("🎵").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_activity").setEmoji("🚀").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_claim").setEmoji("👑").setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_limit").setEmoji("👥").setStyle(ButtonStyle.Secondary)
    );

    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_transfer").setEmoji("🔀").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_kick").setEmoji("👢").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_permit").setEmoji("➕").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_reject").setEmoji("➖").setStyle(ButtonStyle.Secondary)
    );

    await tempChannel.send({
      embeds: [mainEmbed],
      components: [row1, row2, row3, row4, row5]
    });
  }

  // Auto-delete empty channels
  if (oldState.channel && oldState.channel.id !== client.primaryChannelId) {
    if (oldState.channel.members.size === 0 && oldState.channel.parentId === newState.guild?.channels.cache.get(client.primaryChannelId)?.parentId) {
      await oldState.channel.delete().catch(() => {});
    }
  }
});

// --- معالج الأوامر النصية (.v commands) ---
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = ".v";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const channel = message.member.voice.channel;
  if (!channel) {
    return message.reply("❌ You must be in a voice channel to use `.v` commands!");
  }

  if (command === "lock") {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
    return message.reply("🔒 **Voice channel locked.**");
  } 
  else if (command === "unlock") {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: true });
    return message.reply("🔓 **Voice channel unlocked.**");
  } 
  else if (command === "hide") {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
    return message.reply("🙈 **Voice channel hidden.**");
  } 
  else if (command === "unhide") {
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true });
    return message.reply("👀 **Voice channel unhidden.**");
  } 
  else if (command === "name" || command === "rename") {
    const newName = args.join(" ");
    if (!newName) return message.reply("❌ Usage: `.v name [New Name]`");
    await channel.setName(newName);
    return message.reply(`✏️ **Channel renamed to:** \`${newName}\``);
  } 
  else if (command === "limit") {
    const limitNum = parseInt(args[0]);
    if (isNaN(limitNum)) return message.reply("❌ Usage: `.v limit [Number]`");
    await channel.setUserLimit(limitNum);
    return message.reply(`👥 **User limit set to:** \`${limitNum}\``);
  } 
  else if (command === "claim") {
    return message.reply("👑 **You are now the channel owner.**");
  } 
  else if (command === "kick") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `.v kick @User`");
    if (target.voice.channelId === channel.id) {
      await target.voice.disconnect();
      return message.reply(`👢 **Kicked ${target.user.username} from voice.**`);
    } else {
      return message.reply("❌ User is not in your voice channel!");
    }
  } 
  else if (command === "perm" || command === "permit") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `.v perm @User`");
    await channel.permissionOverwrites.edit(target.id, { Connect: true, ViewChannel: true });
    return message.reply(`➕ **Permitted ${target.user.username} to join.**`);
  } 
  else if (command === "reject") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usage: `.v reject @User`");
    await channel.permissionOverwrites.edit(target.id, { Connect: false });
    if (target.voice.channelId === channel.id) {
      await target.voice.disconnect();
    }
    return message.reply(`➖ **Rejected ${target.user.username}.**`);
  } 
  else if (command === "transfer") {
    return message.reply("🔀 **Ownership transfer command received.**");
  } 
  else if (command === "bl") {
    const subCommand = args[0]?.toLowerCase();
    const target = message.mentions.members.first();
    if (subCommand === "add") {
      if (!target) return message.reply("❌ Usage: `.v bl add @User`");
      await channel.permissionOverwrites.edit(target.id, { Connect: false });
      return message.reply(`🚫 **Added ${target.user.username} to Blacklist.**`);
    } else if (subCommand === "remove") {
      if (!target) return message.reply("❌ Usage: `.v bl remove @User`");
      await channel.permissionOverwrites.edit(target.id, { Connect: null });
      return message.reply(`✅ **Removed ${target.user.username} from Blacklist.**`);
    }
  }
});

// Button and Modal Interactions
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
  }

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
