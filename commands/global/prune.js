const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Remove the unused guilds from the database');

module.exports = {
    data: data
}
