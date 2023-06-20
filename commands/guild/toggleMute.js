const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');

const data = new ContextMenuCommandBuilder()
.setName('toggle mute')
.setType(ApplicationCommandType.User)
.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
.setDMPermission(false);

module.exports = {
    data: data
}
