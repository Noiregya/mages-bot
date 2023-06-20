const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

const data = new SlashCommandBuilder()
.setName('menu')
.setDescription('Regenerate the nation messages')
.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
.setDMPermission(false);


module.exports = {
    data: data
}
