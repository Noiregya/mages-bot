const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const data = new ContextMenuCommandBuilder()
.setName('toggle mute')
.setType(ApplicationCommandType.User);

module.exports = {
    data: data
}
