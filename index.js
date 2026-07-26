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
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// أمر تسجيل الـ Setup
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إعداد نظام One Tap Voice")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ تم تسجيل أمر /setup بنجاح!");
  } catch (err) {
    console.error("خطأ فـ تسجيل الأوامر:", err);
  }
});

// عند كتابة أمر /setup
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
      content: `✅ تم إعداد النظام بنجاح!\nالروم الرئيسية: <#${primaryChannel.id}>`,
      ephemeral: true
    });
  }
});

// ميزة One Tap وإرسال لوحة التحكم Voice Manager
client.on("voiceStateUpdate", async (oldState, newState) => {
  // دخول العضو لـ Join to Create
  if (newState.channelId && newState.channelId === client.primaryChannelId) {
    const guild = newState.guild;
    const user = newState.member.user;

    // 1. إنشاء روم صوتية خاصة
    const tempChannel = await guild.channels.create({
      name: `${user.username}`,
      type: ChannelType.GuildVoice,
      parent: newState.channel.parentId,
      permissionOverwrites: [
        {
          id: user.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect]
        }
      ]
    });

    // 2. نقل العضو للروم الجديدة
    await newState.setChannel(tempChannel);

    // 3. إنشاء لوحة الأزرار (Voice Manager Panel)
    const embed = new EmbedBuilder()
      .setTitle("Voice Manager")
      .setDescription(`مرحباً بك <@${user.id}> فـ الروم الصوتية ديالك!\nاستعمل الأزرار لتحت للتحكم فـ الروم.`)
      .setColor("#2b2d31");

    // الصف الأول من الأزرار
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_unlock").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_hide").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_unhide").setEmoji("👻").setStyle(ButtonStyle.Secondary)
    );

    // الصف الثاني من الأزرار
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("v_rename").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_limit").setEmoji("🔢").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("v_claim").setEmoji("👑").setStyle(ButtonStyle.Secondary)
    );

    // إرسال المسج فـ شات الروم الصوتية
    await tempChannel.send({
      content: `Welcome <@${user.id}>`,
      embeds: [embed],
      components: [row1, row2]
    });
  }

  // حذف الروم فاش تخوى
  if (oldState.channel && oldState.channel.id !== client.primaryChannelId) {
    if (oldState.channel.members.size === 0 && oldState.channel.parentId === newState.guild?.channels.cache.get(client.primaryChannelId)?.parentId) {
      await oldState.channel.delete().catch(() => {});
    }
  }
});

// التفاعل مع أزرار التحكم فـ الروم
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const member = interaction.member;

  // التأكد من صلاحيات صاحب الروم (أو الأدمن)
  if (interaction.customId === "v_lock") {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
    await interaction.reply({ content: "🔒 تم قفل الروم بنجاح!", ephemeral: true });
  } else if (interaction.customId === "v_unlock") {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
    await interaction.reply({ content: "🔓 تم فتح الروم!", ephemeral: true });
  } else if (interaction.customId === "v_hide") {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
    await interaction.reply({ content: "👁️ تم إخفاء الروم!", ephemeral: true });
  } else if (interaction.customId === "v_unhide") {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
    await interaction.reply({ content: "👻 تم إظهار الروم!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
