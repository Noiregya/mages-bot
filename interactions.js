const { REST, Routes } = require('discord.js');
//const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const token = process.env.TOKEN;
const applicationId = process.env.APPLICATION_ID || 'not set';

const commands = [];
// Grab all the command files from the commands directory you created earlier

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

// and deploy your commands!
async function register(guild){
    try {
        let data;
        if(guild){   
            const commandFiles = fs.readdirSync('./commands/guild').filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`./commands/guild/${file}`);
                console.log(command);
                commands.push(command.data.toJSON());
            }

            console.log(`Started refreshing ${commands.length} application commands for guild ${guild.name}.`);
            // The put method is used to fully refresh all commands in the guild with the current set
            data = await rest.put(
                Routes.applicationGuildCommands(applicationId, guild.id),
                { body: commands },
            );
        }else{//set global commands
            const commandFiles = fs.readdirSync('./commands/global').filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                console.log(file);
                const command = require(`./commands/global/${file}`);
                console.log(command);
                commands.push(command.data.toJSON());
            }

            console.log(`Started refreshing ${commands.length} global application commands.`);
            data = await rest.put(
                Routes.applicationCommands(applicationId),
                { body: commands },
            );
        }
        let res = `Successfully reloaded ${data.length} application (/) commands.`
        console.log(res);
        return res;
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
}

module.exports = {
    register: register,
    //COMMAND_TYPE: COMMAND_TYPE,
    //OPTION_TYPE: OPTION_TYPE
};