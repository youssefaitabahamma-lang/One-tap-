const {
Client,
GatewayIntentBits,
REST,
Routes,
SlashCommandBuilder,
PermissionFlagsBits,
ChannelType,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder,
ModalBuilder,
TextInputBuilder,
TextInputStyle,
Collection
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildVoiceStates,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

client.voiceOwners = new Collection();
client.voicePanels = new Collection();

const commands = [

new SlashCommandBuilder()

.setName("setup")

.setDescription("Setup One Tap Voice")

.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

].map(cmd=>cmd.toJSON());

client.once("ready",async()=>{

console.log(`${client.user.tag} Online`);

const rest = new REST({version:"10"}).setToken(process.env.TOKEN);

await rest.put(

Routes.applicationCommands(client.user.id),

{body:commands}

);

console.log("Slash Commands Loaded");

});
client.on("interactionCreate", async (interaction) => {

if (!interaction.isChatInputCommand()) return;

if (interaction.commandName !== "setup") return;

const guild = interaction.guild;

const category = await guild.channels.create({
name: "🎤 ONE TAP",
type: ChannelType.GuildCategory
});

const join = await guild.channels.create({
name: "➕ Join to Create",
type: ChannelType.GuildVoice,
parent: category.id
});

const panel = await guild.channels.create({
name: "💬 voice-panel",
type: ChannelType.GuildText,
parent: category.id
});

client.joinChannel = join.id;
client.panelChannel = panel.id;

const embed = new EmbedBuilder()

.setColor("#5865F2")

.setTitle(`🎤 ${guild.name} Voice Manager`)

.setDescription(
"**Welcome to One Tap Voice!**\n\nJoin **➕ Join to Create** to create your own temporary voice channel.\n\nUse the buttons below to manage your room."
)

.setThumbnail(guild.iconURL({ dynamic: true }))

.setImage(
guild.bannerURL({ size: 1024 }) ||
guild.iconURL({ dynamic: true, size: 1024 })
)

.setFooter({
text: "One Tap Voice",
iconURL: guild.iconURL({ dynamic: true })
});

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
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("limit")
.setLabel("Limit")
.setEmoji("👥")
.setStyle(ButtonStyle.Secondary)

);

const row2 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim")
.setLabel("Claim")
.setEmoji("👑")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("transfer")
.setLabel("Transfer")
.setEmoji("🔄")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("hide")
.setLabel("Hide")
.setEmoji("🙈")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("unhide")
.setLabel("Unhide")
.setEmoji("👀")
.setStyle(ButtonStyle.Secondary)

);

await panel.send({
embeds:[embed],
components:[row1,row2]
});

await interaction.reply({
content:"✅ One Tap Voice has been setup successfully!",
ephemeral:true
});

});
client.on("voiceStateUpdate", async (oldState, newState) => {

if (!client.joinChannel) return;

if (newState.channelId === client.joinChannel) {

const member = newState.member;

const channel = await member.guild.channels.create({

name: `🔊 ${member.user.username}`,

type: ChannelType.GuildVoice,

parent: newState.channel.parentId,

permissionOverwrites: [

{

id: member.id,

allow: [

PermissionFlagsBits.ManageChannels,

PermissionFlagsBits.MoveMembers,

PermissionFlagsBits.Connect

]

},

{

id: member.guild.roles.everyone,

allow: [

PermissionFlagsBits.Connect,

PermissionFlagsBits.ViewChannel

]

}

]

});

client.voiceOwners.set(channel.id, member.id);

await member.voice.setChannel(channel);

}

if (

oldState.channel &&

oldState.channel.id !== client.joinChannel &&

oldState.channel.members.size === 0

) {

client.voiceOwners.delete(oldState.channel.id);

await oldState.channel.delete().catch(() => {});

}

});
client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton()) return;

const member = interaction.member;

const channel = member.voice.channel;

if (!channel)
return interaction.reply({
content:"❌ You must be in your voice channel.",
ephemeral:true
});

const owner = client.voiceOwners.get(channel.id);

if (owner !== member.id)
return interaction.reply({
content:"❌ You are not the owner of this room.",
ephemeral:true
});

switch(interaction.customId){

case "lock":

await channel.permissionOverwrites.edit(
interaction.guild.roles.everyone,
{
Connect:false
}
);

return interaction.reply({
content:"🔒 Voice Locked",
ephemeral:true
});

case "unlock":

await channel.permissionOverwrites.edit(
interaction.guild.roles.everyone,
{
Connect:true
}
);

return interaction.reply({
content:"🔓 Voice Unlocked",
ephemeral:true
});

case "hide":

await channel.permissionOverwrites.edit(
interaction.guild.roles.everyone,
{
ViewChannel:false
}
);

return interaction.reply({
content:"🙈 Voice Hidden",
ephemeral:true
});

case "unhide":

await channel.permissionOverwrites.edit(
interaction.guild.roles.everyone,
{
ViewChannel:true
}
);

return interaction.reply({
content:"👀 Voice Visible",
ephemeral:true
});

}
});
client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton()) return;

if (interaction.customId === "rename") {

const modal = new ModalBuilder()
.setCustomId("rename_modal")
.setTitle("Rename Voice");

const input = new TextInputBuilder()
.setCustomId("voice_name")
.setLabel("New Voice Name")
.setStyle(TextInputStyle.Short)
.setRequired(true);

const row = new ActionRowBuilder().addComponents(input);

modal.addComponents(row);

return interaction.showModal(modal);

}

if (interaction.customId === "limit") {

const modal = new ModalBuilder()
.setCustomId("limit_modal")
.setTitle("Voice Limit");

const input = new TextInputBuilder()
.setCustomId("voice_limit")
.setLabel("Limit (0-99)")
.setStyle(TextInputStyle.Short)
.setRequired(true);

const row = new ActionRowBuilder().addComponents(input);

modal.addComponents(row);

return interaction.showModal(modal);

}

});

client.on("interactionCreate", async (interaction)=>{

if(!interaction.isModalSubmit()) return;

const channel = interaction.member.voice.channel;

if(!channel)
return interaction.reply({
content:"❌ Join your voice first.",
ephemeral:true
});

if(interaction.customId==="rename_modal"){

const name =
interaction.fields.getTextInputValue("voice_name");

await channel.setName(name);

return interaction.reply({
content:`✏️ Voice renamed to **${name}**`,
ephemeral:true
});

}

if(interaction.customId==="limit_modal"){

const limit = parseInt(
interaction.fields.getTextInputValue("voice_limit")
);

if(isNaN(limit)||limit<0||limit>99){

return interaction.reply({
content:"❌ Enter a number between 0 and 99.",
ephemeral:true
});

}

await channel.setUserLimit(limit);

return interaction.reply({
content:`👥 Limit set to **${limit}**`,
ephemeral:true
});

}

});
client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton()) return;

const member = interaction.member;
const channel = member.voice.channel;

if (!channel) return;

const owner = client.voiceOwners.get(channel.id);

if (owner !== member.id) {
return interaction.reply({
content:"❌ You are not the owner of this room.",
ephemeral:true
});
}

switch(interaction.customId){

case "claim":

client.voiceOwners.set(channel.id, member.id);

return interaction.reply({
content:"👑 You are now the room owner.",
ephemeral:true
});

case "kick": {

const target = channel.members
.filter(m => m.id !== member.id)
.first();

if(!target){
return interaction.reply({
content:"❌ No member to kick.",
ephemeral:true
});
}

await target.voice.disconnect();

return interaction.reply({
content:`👢 ${target.user.username} has been kicked.`,
ephemeral:true
});

}

case "transfer": {

const target = channel.members
.filter(m => m.id !== member.id)
.first();

if(!target){
return interaction.reply({
content:"❌ No member found.",
ephemeral:true
});
}

client.voiceOwners.set(channel.id,target.id);

return interaction.reply({
content:`🔄 Ownership transferred to ${target.user.username}`,
ephemeral:true
});

}

case "permit":

return interaction.reply({
content:"➕ Permit system will be added in the next part.",
ephemeral:true
});

case "reject":

return interaction.reply({
content:"➖ Reject system will be added in the next part.",
ephemeral:true
});

}

});
const {
ActionRowBuilder,
StringSelectMenuBuilder,
PermissionFlagsBits
} = require("discord.js");

client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton()) return;

const channel = interaction.member.voice.channel;
if (!channel) return;

if (interaction.customId === "permit") {

const options = channel.guild.members.cache
.filter(m => !m.user.bot)
.map(m => ({
label: m.user.username,
value: m.id
}))
.first(25);

const menu = new StringSelectMenuBuilder()
.setCustomId("permit_select")
.setPlaceholder("Select a member")
.addOptions(options);

return interaction.reply({
content: "➕ Select a member to permit:",
components: [new ActionRowBuilder().addComponents(menu)],
ephemeral: true
});

}

if (interaction.customId === "reject") {

const options = channel.members
.filter(m => m.id !== interaction.user.id)
.map(m => ({
label: m.user.username,
value: m.id
}))
.first(25);

const menu = new StringSelectMenuBuilder()
.setCustomId("reject_select")
.setPlaceholder("Select a member")
.addOptions(options);

return interaction.reply({
content: "➖ Select a member to reject:",
components: [new ActionRowBuilder().addComponents(menu)],
ephemeral: true
});

}

});

client.on("interactionCreate", async (interaction) => {

if (!interaction.isStringSelectMenu()) return;

const channel = interaction.member.voice.channel;
if (!channel) return;

if (interaction.customId === "permit_select") {

const userId = interaction.values[0];

await channel.permissionOverwrites.edit(userId, {
Connect: true,
ViewChannel: true
});

return interaction.update({
content: "✅ Member permitted.",
components: []
});

}

if (interaction.customId === "reject_select") {

const userId = interaction.values[0];

await channel.permissionOverwrites.edit(userId, {
Connect: false
});

const member = interaction.guild.members.cache.get(userId);

if (member?.voice.channelId === channel.id) {
await member.voice.disconnect();
}

return interaction.update({
content: "🚫 Member rejected.",
components: []
});

}

});
client.on("interactionCreate", async (interaction) => {

if (!interaction.isButton()) return;

const channel = interaction.member.voice.channel;

if (!channel) return;

switch (interaction.customId) {

case "info":

return interaction.reply({
embeds:[
new EmbedBuilder()

.setColor("#5865F2")

.setTitle("🎤 Voice Information")

.addFields(
{name:"📛 Name",value:channel.name,inline:true},
{name:"👥 Members",value:String(channel.members.size),inline:true},
{name:"🔊 Bitrate",value:`${channel.bitrate/1000} kbps`,inline:true},
{name:"👑 Owner",value:`<@${client.voiceOwners.get(channel.id) || interaction.user.id}>`,inline:true},
{name:"🔢 Limit",value:String(channel.userLimit || "Unlimited"),inline:true}
)

.setThumbnail(interaction.guild.iconURL({dynamic:true}))
],
ephemeral:true
});

case "bitrate": {

const bitrate = Math.min(channel.bitrate + 8000, 96000);

await channel.setBitrate(bitrate);

return interaction.reply({
content:`🎵 Bitrate changed to **${bitrate/1000} kbps**`,
ephemeral:true
});

}

case "region":

return interaction.reply({
content:"🌍 Discord removed manual Voice Regions. The server chooses the best region automatically.",
ephemeral:true
});

}

});
client.on("voiceStateUpdate", async (oldState, newState) => {

if (!oldState.channel) return;

const channel = oldState.channel;

if (!client.voiceOwners.has(channel.id)) return;

// إذا خرج المالك
const ownerId = client.voiceOwners.get(channel.id);

if (oldState.member.id === ownerId) {

const nextOwner = channel.members.first();

if (nextOwner) {

client.voiceOwners.set(channel.id,nextOwner.id);

const log = client.channels.cache.get(client.panelChannel);

if(log){

log.send(
`👑 ${nextOwner} is now the owner of **${channel.name}**`
).catch(()=>{});

}

}else{

client.voiceOwners.delete(channel.id);

await channel.delete().catch(()=>{});

}

}

// حذف الروم إذا بقات خاوية
if(channel.members.size===0){

client.voiceOwners.delete(channel.id);

await channel.delete().catch(()=>{});

}

});

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const channel=interaction.member.voice.channel;

if(!channel){

return interaction.reply({

content:"❌ Join your voice channel first.",

ephemeral:true

});

}

});

client.login(process.env.TOKEN);
