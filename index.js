const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    ChannelType, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// متغير باش نخزنوا فيه ID ديال روم Create Voice اللي أيتحدد بـ /setup
let createVoiceChannelId = null;

// خريطة لتسجيل ملكية الرومات الصوتية المؤقتة
const tempChannels = new Map();

// 1️⃣ تعريف وتدشين أمر /setup
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد نظام الرومات الصوتية التلقائية (Join to Create)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('اختر الروم الصوتية اللي أيدخلوا ليها الناس باش تكرى ليهم روم جديدة')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
        )
].map(command => command.toJSON());

// 2️⃣ عند تشغيل البوت: تسجيل الأوامر فـ Discord
client.once('ready', async () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('🔄 جاري تسجيل أوامر Slash Commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ تم تسجيل أمر /setup بنجاح!');
    } catch (error) {
        console.error('❌ خطأ أثناء تسجيل الأوامر:', error);
    }
});

// 3️⃣ الاستجابة لأمر /setup
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup') {
        // التأكد واش العضو عندو صلاحية إدارة القنوات
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ 
                content: '❌ ما عندكش صلاحية (Manage Channels) باش تستعمل هاد الأمر!', 
                ephemeral: true 
            });
        }

        const selectedChannel = interaction.options.getChannel('channel');
        createVoiceChannelId = selectedChannel.id;

        await interaction.reply({
            content: `✅ تم إعداد نظام Voice بنجاح! الروم المحددة هي: **${selectedChannel.name}**`,
            ephemeral: true
        });
    }
});

// 4️⃣ نظام الإنشاء والمسح التلقائي للرومات الصوتية
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!createVoiceChannelId) return;

    const user = newState.member.user;
    const guild = newState.guild;

    // دخـول روم Create Voice
    if (newState.channelId === createVoiceChannelId) {
        try {
            const createdChannel = await guild.channels.create({
                name: `🔊 ${user.username}'s Room`,
                type: ChannelType.GuildVoice,
                parent: newState.channel?.parentId || null,
                permissionOverwrites: [
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.Connect
                        ]
                    }
                ]
            });

            tempChannels.set(createdChannel.id, user.id);
            await newState.setChannel(createdChannel);
        } catch (error) {
            console.error('خطأ أثناء إنشاء الروم:', error);
        }
    }

    // خـروج من الروم الخاوية
    if (oldState.channelId && tempChannels.has(oldState.channelId)) {
        const channel = oldState.channel;
        if (channel && channel.members.size === 0) {
            tempChannels.delete(channel.id);
            await channel.delete().catch(console.error);
        }
    }
});

// 5️⃣ أمر .v reject
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.v ')) return;

    const args = message.content.slice(3).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'reject') {
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel || !tempChannels.has(voiceChannel.id)) {
            return message.reply('❌ خاصك تكون فـ الروم الصوتية المؤقتة ديالك باش تستعمل هاد الأمر!');
        }

        if (tempChannels.get(voiceChannel.id) !== message.author.id) {
            return message.reply('❌ أنت ماشي هو مول هاد الروم!');
        }

        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.reply('❌ طاقي الشخص اللي باغي تجريه: `.v reject @user`');
        }

        try {
            await voiceChannel.permissionOverwrites.edit(targetMember.id, {
                Connect: false
            });

            if (targetMember.voice.channelId === voiceChannel.id) {
                await targetMember.voice.disconnect();
            }

            message.reply(`🚫 تم منع ${targetMember.user.username} من دخول الروم ديالك!`);
        } catch (error) {
            console.error(error);
            message.reply('❌ وقع خطأ أثناء تطبيق الأمر.');
        }
    }
});

client.login(process.env.TOKEN);
