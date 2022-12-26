const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register the bot commands');

module.exports = {
    data: data
}