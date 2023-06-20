const { SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register the bot commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


module.exports = {
    data: data
}
