
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('List all currently muted users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
	.setDMPermission(false);

module.exports = {
    data: data
}
