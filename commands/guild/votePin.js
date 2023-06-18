const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const data = new ContextMenuCommandBuilder()
.setName('vote to pin')
.setType(ApplicationCommandType.Message);

module.exports = {
    data: data
}
