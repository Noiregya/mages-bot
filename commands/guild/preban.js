const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

const data = new SlashCommandBuilder()
.setName('preban')
.setDescription('Bans a user immediately after they join the guild').addStringOption(
    option => 
    option.setName('userid')
    .setDescription('Id of the user to ban')
    .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
	.setDMPermission(false);


module.exports = {
    data: data
}
