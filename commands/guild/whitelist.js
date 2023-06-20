
    
const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Receive or stop receiving bot notifications')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
	.setDMPermission(false);

module.exports = {
    data: data
}
