const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const token = process.env.TOKEN;
const applicationId = process.env.APPLICATION_ID || 'not set';

const guildCommands = [];
const globalCommands = [];

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

//Deploy the commands
async function register(guild){
    try {
        //delete all commands
        await rest.put(
            Routes.applicationGuildCommands(applicationId, guild.id),
            { body: [] },
        );
        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: [] },
        );
        let data;
        if(guild){//The commands need to be deployed at a guild level
            const commandFiles = fs.readdirSync('./commands/guild').filter(file => file.endsWith('.js'));
            if(guildCommands.length === 0){
                for (const file of commandFiles) {
                    const command = require(`./commands/guild/${file}`);
                    guildCommands.push(command.data.toJSON());
                }
                console.log(`Started refreshing ${guildCommands.length} application commands`);
            }
            // The put method is used to fully refresh all commands in the guild with the current set
            data = await rest.put(
                Routes.applicationGuildCommands(applicationId, guild.id),
                { body: guildCommands },
            );
        }else{//The commands need to be deployed at the global level
            const commandFiles = fs.readdirSync('./commands/global').filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`./commands/global/${file}`);
                globalCommands.push(command.data.toJSON());
            }

            console.log(`Started refreshing ${globalCommands.length} global application commands.`);
            data = await rest.put(
                Routes.applicationCommands(applicationId),
                { body: globalCommands },
            );
        }
        let res = `Successfully registered ${data.length} application (/) commands.`
        return res;
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
}

module.exports = {
    register: register,
};
