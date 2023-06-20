const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');

const data = new ContextMenuCommandBuilder()
.setName('vote to pin')
.setType(ApplicationCommandType.Message)
.setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
.setDMPermission(false);

module.exports = {
    data: data
}
