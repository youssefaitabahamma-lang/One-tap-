const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// تعريف أمر /setup
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إعداد نظام One Tap Voice")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
  
  // تسجيل Slash Commands تلقائياً فاش يخدم البوت
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ تم تسجيل أمر /setup بنجاح!");
  } catch (err) {
    console.error("خطأ فـ تسجيل الأوامر:", err);
  }
});

// التعامل مع أمر /setup
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setup") {
    const guild = interaction.guild;
    
    // إنشاء Category وروم Voice رئيسية
    const category = await guild.channels.create({
      name: "🔊 ONE TAP VOICE",
      type: ChannelType.GuildCategory
    });

    const primaryChannel = await guild.channels.create({
      name: "➕ Join to Create",
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    // تخزين ID ديال الروم الرئيسية فـ البوت
    client.primaryChannelId = primaryChannel.id;

    await interaction.reply({
      content: `✅ تم إعداد النظام بنجاح!\nالروم الرئيسية: <#${primaryChannel.id}>`,
      ephemeral: true
    });
  }
});

// ميزة One Tap: تحويل العضو وروم مخصصة
client.on("voiceStateUpdate", async (oldState, newState) => {
  // فاش يدخل العضو للروم الرئيسية
  if (newState.channelId && newState.channelId === client.primaryChannelId) {
    const guild = newState.guild;
    const user = newState.member.user;

    // إنشاء روم خاصة بالعضو
    const tempChannel = await guild.channels.create({
      name: `🔊 ${user.username}`,
      type: ChannelType.GuildVoice,
      parent: newState.channel.parentId
    });

    // نقل العضو للروم الجديدة
    await newState.setChannel(tempChannel);
  }

  // فاش يخرج العضو وتخوى الروم المؤقتة، يتم حذفها أوتوماتيكياً
  if (oldState.channel && oldState.channel.id !== client.primaryChannelId) {
    if (oldState.channel.name.startsWith("🔊 ") && oldState.channel.members.size === 0) {
      await oldState.channel.delete().catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
