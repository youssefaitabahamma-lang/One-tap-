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

// 🔴 يمكنك وضع الـ ID مباشرة هنا إذا أردت تثبيت الروم بدون الحاجة لأمر /setup
let CREATE_VOICE_CHANNEL_ID = 'حط_هنا_ID_ديال_روم_Create_Voice';

// خريطة لتسجيل ملكية الرومات الصوتية المؤقتة
const tempChannels = new Map();

// 1️⃣ إعداد أمر الـ Slash Command (/setup)
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

// 2️⃣ عند تشغيل البوت: تسجيل أمر /setup فـ Discord
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

// 3️⃣ الاستجابة لأمر /setup فـ Discord
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ 
                content: '❌ ما عندكش صلاحية (Manage Channels) باش تستعمل هاد الأمر!', 
                ephemeral: true 
            });
        }

        const selectedChannel = interaction.options.getChannel('channel');
        CREATE_VOICE_CHANNEL_ID = selectedChannel.id;

        await interaction.reply({
            content: `✅ تم إعداد نظام Voice بنجاح! الروم المحددة هي: **${selectedChannel.name}**`,
            ephemeral: true
        });
    }
});

// 4️⃣ كود الإنشاء والمسح التلقائي للـ Voice Channels
client.on('voiceStateUpdate', async (oldState, newState) => {
    const user = newState.member.user;
    const guild = newState.guild;

    // حالة 1: العضو دخل لـ روم "Create Voice"
    if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
        try {
            // إنشاء روم صوتية جديدة بسمية العضو
            const createdChannel = await guild.channels.create({
                name: `🔊 ${user.username}'s Room`,
                type: ChannelType.GuildVoice,
                parent: newState.channel?.parentId || null,
                permissionOverwrites: [
                    {
                        id: user.id, // مول الروم كياخد صلاحيات التحكم
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.Connect
                        ]
                    }
                ]
            });

            // تسجيل المول ديال الروم
            tempChannels.set(createdChannel.id, user.id);

            // نقل العضو للروم الجديدة تلقائياً
            await newState.setChannel(createdChannel);
        } catch (error) {
            console.error('Error creating voice channel:', error);
        }
    }

    // حالة 2: العضو خرج من روم مؤقتة وكان فيها 0 أعضاء -> مسح الروم
    if (oldState.channelId && tempChannels.has(oldState.channelId)) {
        const channel = oldState.channel;
        if (channel && channel.members.size === 0) {
            tempChannels.delete(channel.id);
            await channel.delete().catch(console.error);
        }
    }
});

// 5️⃣ أوامر التحكم فـ الروم (مثال: .v reject @user)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.v ')) return;

    const args = message.content.slice(3).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // أمر الطرد والمنع .v reject
    if (command === 'reject') {
        const voiceChannel = message.member.voice.channel;

        // التأكد واش الشخص فـ روم صوتية مؤقتة وهوا صاحب الروم
        if (!voiceChannel || !tempChannels.has(voiceChannel.id)) {
            return message.reply('❌ خاصك تكون فـ الروم الصوتية المؤقتة ديالك باش تستعمل هاد الأمر!');
        }

        if (tempChannels.get(voiceChannel.id) !== message.author.id) {
            return message.reply('❌ أنت ماشي هو مول هاد الروم!');
        }

        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.reply('❌ من فضلك طاقي الشخص اللي باغي تجريه: `.v reject @user`');
        }

        try {
            // سحب صلاحية الدخول من الشخص
            await voiceChannel.permissionOverwrites.edit(targetMember.id, {
                Connect: false
            });

            // إلا كان الشخص فـ نفس الروم، كيجري عليه البوت بـ قطع الاتصال
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
