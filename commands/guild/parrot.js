
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
.setName('parrot')
.setDescription('Repeat what you want using the bot').addStringOption(
    option => 
    option.setName('text')
    .setDescription('Text to echo back')
    .setRequired(true)).addChannelOption(
    option =>
    option.setName('channel')
    .setDescription('The channel to repeat into')
    .setRequired(false));

module.exports = {
    data: data
}