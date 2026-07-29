const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../config');
const db = require('../database');
const { runSetup } = require('../commands/setup');
const { buildInfoEmbed, buildHelpEmbed } = require('../utils/embeds');
const tc = require('../utils/tempChannel');

function errorEmbed(message) {
  return new EmbedBuilder().setColor(config.errorColor).setDescription(`❌ ${message}`);
}
function successEmbed(message) {
  return new EmbedBuilder().setColor(config.successColor).setDescription(message);
}

// Buttons that require picking a target member -> mapped to a select-menu prompt.
const SELECT_TARGET_ACTIONS = {
  vc_kick: { placeholder: 'Select a member to disconnect', label: 'Disconnect' },
  vc_perm: { placeholder: 'Select a member to trust', label: 'Trust' },
  vc_reject: { placeholder: 'Select a member to reject', label: 'Reject' },
  vc_transfer: { placeholder: 'Select a member to transfer ownership to', label: 'Transfer Ownership' },
};

// Buttons that run instantly with no extra input.
const INSTANT_ACTIONS = {
  vc_lock: tc.lockChannel,
  vc_unlock: tc.unlockChannel,
  vc_hide: tc.hideChannel,
  vc_unhide: tc.unhideChannel,
  vc_claim: tc.claimChannel,
};

async function handleButton(interaction) {
  const { customId, member } = interaction;

  // ---- Rename / Limit -> open a modal ----
  if (customId === 'vc_rename') {
    const modal = new ModalBuilder().setCustomId('vc_modal_rename').setTitle('Rename Voice Channel');
    const input = new TextInputBuilder()
      .setCustomId('vc_rename_input')
      .setLabel('New channel name')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId === 'vc_limit') {
    const modal = new ModalBuilder().setCustomId('vc_modal_limit').setTitle('Set User Limit');
    const input = new TextInputBuilder()
      .setCustomId('vc_limit_input')
      .setLabel('User limit (0 = unlimited, max 99)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ---- Info ----
  if (customId === 'vc_info') {
    const { channel, data } = tc.getUserTempChannel(member);
    return interaction.reply({ embeds: [buildInfoEmbed(channel, data, interaction.guild)], ephemeral: true });
  }

  // ---- Instant actions ----
  if (INSTANT_ACTIONS[customId]) {
    const msg = await INSTANT_ACTIONS[customId](member);
    return interaction.reply({ embeds: [successEmbed(msg)], ephemeral: true });
  }

  // ---- Actions requiring a target member ----
  if (SELECT_TARGET_ACTIONS[customId]) {
    // Validate up-front that the user is in a managed temp channel before prompting.
    tc.getUserTempChannel(member);

    const { placeholder } = SELECT_TARGET_ACTIONS[customId];
    const selectId = customId.replace('vc_', 'vc_select_');
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(selectId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1)
    );
    return interaction.reply({ content: `Please select a member below:`, components: [row], ephemeral: true });
  }
}

async function handleUserSelect(interaction) {
  const { customId, member, values } = interaction;
  const targetId = values[0];
  const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);

  let msg;
  switch (customId) {
    case 'vc_select_kick':
      msg = await tc.kickUser(member, targetMember);
      break;
    case 'vc_select_perm':
      msg = await tc.permitUser(member, targetMember);
      break;
    case 'vc_select_reject':
      msg = await tc.rejectUser(member, targetMember);
      break;
    case 'vc_select_transfer':
      msg = await tc.transferChannel(member, targetMember);
      break;
    default:
      return;
  }

  await interaction.update({ content: null, embeds: [successEmbed(msg)], components: [] });
}

async function handleModal(interaction) {
  const { customId, member } = interaction;

  if (customId === 'vc_modal_rename') {
    const newName = interaction.fields.getTextInputValue('vc_rename_input');
    const msg = await tc.renameChannel(member, newName);
    return interaction.reply({ embeds: [successEmbed(msg)], ephemeral: true });
  }

  if (customId === 'vc_modal_limit') {
    const limit = interaction.fields.getTextInputValue('vc_limit_input');
    const msg = await tc.setLimit(member, limit);
    return interaction.reply({ embeds: [successEmbed(msg)], ephemeral: true });
  }
}

async function handleSlashCommand(interaction) {
  if (interaction.commandName === 'setup') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ embeds: [errorEmbed('You need the **Manage Server** permission to run setup.')], ephemeral: true });
    }
    const existing = db.getGuildConfig(interaction.guild.id);
    if (existing && interaction.guild.channels.cache.has(existing.jtcChannelId)) {
      return interaction.reply({ embeds: [errorEmbed('OneTap is already set up in this server.')], ephemeral: true });
    }
    await interaction.reply({ embeds: [successEmbed('⚙️ Setting up OneTap... this may take a few seconds.')] });
    const { interfaceChannel } = await runSetup(interaction.guild);
    await interaction.editReply({ embeds: [successEmbed(`✅ Setup complete! Head to ${interfaceChannel} to see your control panel.`)] });
    return;
  }

  if (interaction.commandName === 'help') {
    return interaction.reply({ embeds: [buildHelpEmbed(interaction.guild)], ephemeral: true });
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) return await handleSlashCommand(interaction);
      if (interaction.isButton()) return await handleButton(interaction);
      if (interaction.isUserSelectMenu()) return await handleUserSelect(interaction);
      if (interaction.isModalSubmit()) return await handleModal(interaction);
    } catch (err) {
      const embed = err instanceof tc.VoiceActionError ? errorEmbed(err.message) : errorEmbed('Something went wrong processing that action.');
      if (!(err instanceof tc.VoiceActionError)) console.error('[interactionCreate] Unexpected error:', err);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      }
    }
  },
};
