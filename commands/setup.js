const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup the One Tap voice system"),

  async execute(interaction) {
    await interaction.reply({
      content: "✅ One Tap setup completed!",
      ephemeral: true,
    });
  },
};
