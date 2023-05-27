
    
const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Receive or stop receiving bot notifications');

module.exports = {
    data: data
}
