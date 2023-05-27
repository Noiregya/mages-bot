
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('List all currently muted users');

module.exports = {
    data: data
}
