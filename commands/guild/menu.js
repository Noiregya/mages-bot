const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
.setName('menu')
.setDescription('Regenerate the nation messages');

module.exports = {
    data: data
}
