const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

const data = new SlashCommandBuilder()
.setName('unban')
.setDescription('Remove a user from the ban list').addStringOption(
    option => 
    option.setName('userid')
    .setDescription('Id of the user to unban')
    .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
	.setDMPermission(false);

module.exports = {
    data: data
}
