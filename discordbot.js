//TODO: Create polls
//TODO: Check for inactive users
//TODO: Cleanup unused code
//TODO: Auto administration
//TODO: Welcome channel
//TODO: Pin channel
//TODO: SECURE COMMAND equivalent: copies pinned messages to a pin channel
//TODO: Activity monitor: Keep track of active users to prune inactive ones
//TODO: RELOAD COMMAND EQUIVALENT: Send necessary messages in the welcome channel
//TODO: FREEZE/UNFREEZE server: Mutes all new users in case of a raid
const { Client, Events, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');

//Discord intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution
    ]
});

const Token = process.env.TOKEN;
const Owner = process.env.OWNER;
var ownerUser;
const tools = require('./tools');
const dao = require('./dao');
const business = require('./business');
const personality = require('./personality');
const interactions = require('./interactions');
const webpage = require('./webpage.js');
const { errorContext, randomFromArray } = require('./tools');
const intervalStarted = false;
const dayInMS = 86400000;

const HELP_MESSAGE = tools.help;

function wasUpdated(){
//Check for version number change
    try {
        let versionFlag = '';
        let version = process.env.npm_package_version;
        if (version.substring(version.length - 2, version.length) === 'rc')
            console.log('Warning: This is a release candidate, do not run this in production');
        try { versionFlag = fs.readFileSync('version_flag', 'utf8') } catch { };
        if (versionFlag !== version) {
            //if(tools.compareVersions(version, versionFlag) < -1)TODO
            fs.readdirSync('sql').forEach(file => {
                console.log('Found '+file);
                if(file.substring(file.length-4)==='.sql'){
                    console.log('File is sql, compareversion: '+tools.compareVersions(file.substring(0, file.length-4), versionFlag));
                    if(tools.compareVersions(file.substring(0, file.length-4), versionFlag) === 1){
                        console.log(`Updating database: loading ${file}`);
                        dao.rawQuery(fs.readFileSync('sql/'+file).toString());
                    }
                }
              });
            fs.writeFileSync('version_flag', version);
            console.log('MAGES. updated to version ' + version);
            return true;
        }
        return false;
    } catch (err) {
        console.error(err);
        return true;
    };
}

//The bot version has been changed
function initialize() {
    interactions.register();
    //Update all servers
    client.guilds.fetch().then(function (guilds) {
        guilds.forEach(function(guild){
            interactions.register(guild);
        });
        console.log(`Global commands updated\nGuild commands updated for ${guilds.size} guilds`);
    });
}

///////////////////////////// DEBUG DISPLAY ALL EVENTS /////////////////////////////
/*
function patchEmitter(emitter) {
    var oldEmit = emitter.emit;

    emitter.emit = function() {
        var emitArgs = arguments;
        if(arguments[0] === 'raw'){
            console.log(arguments[1].t);
        }else{
            console.log(arguments[0]);
        }
        oldEmit.apply(emitter, arguments);
    };
}
patchEmitter(client);
*/
///////////////////////////// DEBUG DISPLAY ALL EVENTS //////////////////////////////

///// On even ready /////
client.on('ready', function () {
    if(wasUpdated())
        initialize();
    //Start website
    webpage.init(client);
    //Initialize client
    client.application.fetch().then(function (application) {
        ownerUser = application.owner;
        console.log('Welcome to MAGES.' + '\nOwner: ' + ownerUser.tag);
        ownerUser.createDM().then(DMchannel => {
            DMchannel.send("I had to restart, remember to check the logs if you don't know why!").catch(err => {
                console.error(err);
            });
        }), err => { console.error(err) };
    }).catch(err => { console.error(err) });

    console.log('Logged in as ' + client.user.tag + '!');

    client.guilds.fetch().then(function (guilds) {
        if (guilds.available)
            guilds = new Array(guilds);
        business.updateGuilds(guilds);
        business.pruneGuilds(guilds, false).then(res => console.log(res));
        guilds.forEach(function (guild) {
            console.log('Available guild ' + guild.name);
        });
    });

    const updateShares = async function(client){
        console.log('Updating shares:');
        const guilds = await client.guilds.fetch();
        for(guild of guilds){
            const fetchedGuild = await client.guilds.fetch(guild[0]);
            let res = await business.updateNationShares(fetchedGuild);
            //console.log(res);
        }
    }

    const updatePresence = function(client){
        client.user.setPresence({ activities: [tools.randomFromArray(tools.statuses)], status: 'online' });
    }

    updateShares(client);
    let shareFunction = setInterval(updateShares, 300000, client);

    updatePresence(client);
    let changePresence = setInterval(updatePresence, 12 * 60 * 60 * 1000, client);

    /*
    var periodic = function(){
        tools.asyncForEach(client.guilds.cache.array(),function(thisGuild){
            tools.removeRoleFromInactive(thisGuild);
        });
    };
    var boundPeriodic = periodic.bind(this);
    client.setInterval(boundPeriodic, 43200000);
    //Load sheduled events
    tools.loadTimedEvents(client);*/

});
/////On event "ready" end/////

client.on(Events.InteractionCreate, async interaction => {
    let res;
    if (interaction.isChatInputCommand()) {
        switch (String(interaction.commandName)) {
            case 'mute':
                res = await business.muteList(interaction);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'whitelist':
                res = await business.toggleWhitelist(interaction.member);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'parrot':
                res = await business.parrot(interaction);
                if (interaction.deferred)
                    interaction.editReply(res);
                else
                    interaction.reply({ content: res, ephemeral: true });
                break;
            case 'register':
                res = await business.register(interaction);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'prune':
                res = await business.prune(interaction);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'preban':
                res = await business.preban(interaction);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'unban':
                res = await business.unban(interaction);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'menu':
                await interaction.deferReply({ ephemeral: true });
                res = await business.updateMenu(interaction);
                await interaction.editReply({ content: res});
                break;
        }
    } else if (interaction.isUserContextMenuCommand()) {
        switch (String(interaction.commandName)) {
            case 'toggle mute':
                res = await business.muteUnmute(client, interaction);
                interaction.reply({ content: res, ephemeral: true });
                break;
            case 'register':
                res = await interactions.register();
                await interaction.reply({ content: res, ephemeral: true });
                break;
        }
    } else if (interaction.isMessageContextMenuCommand()) {
        //Message context menu commands
        switch (String(interaction.commandName)){
            case 'vote to pin':
                res = await business.votePin(interaction);
            break;
        }
        if(res && typeof res === 'string' && res.length > 0)
            interaction.reply({ content: res, ephemeral: true });
    } else if (interaction.isButton()) {
        let type = interaction.customId.split('_')[0];
        switch(type){
            case 'nation'://Good practice only return error as a string
                res = await business.toggleNation(interaction);
            break;
            case 'delete':
                res = await interaction.message.delete();
            break;
            case 'pin':
                res = await business.addVotePin(interaction, interaction.customId.split('_')[1]);
            break;
        }
        if(res && typeof res === 'string' && res.length > 0)
            interaction.reply({ content: res, ephemeral: true });
    }

});
//TODO: Variablilize events
client.on('warn', function (warn) {
    tools.genericEventNotifier(ownerUser, 'warn', warn);
});
client.on('error', function (error) {
    tools.genericEventNotifier(ownerUser, 'error', error);
});
client.on('guildCreate', function (guild) {
    tools.genericEventNotifier(ownerUser, 'guildCreate', guild);
    dao.registerGuild(guild);
});
client.on('guildDelete', function (guild) {
    tools.genericEventNotifier(ownerUser, 'guildDelete', guild);
});

client.on('guildMemberUpdate', function (oldMember, newMember) {
    //Calculate differences
    let roleRemoved = oldMember._roles.filter(x => !newMember._roles.includes(x));
    let roleAdded = newMember._roles.filter(x => !oldMember._roles.includes(x));
    //Roles has been added
    if (roleAdded.length > 0) {
        roleAdded.every(function (role) {
            //Check if one of the added role is a mod role, if they can manage messages
            if (!oldMember.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
                newMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                newMember.user.createDM().then(function (DM) {
                    DM.send(`You received a role that makes you eligible to notifications for ${newMember.guild.name}. To receive notifications, 
                        type /whitelist in the guild.`).catch(function (err) { console.error(err); });
                }, function (err) { tools.errorLog(tools.errorContext(err, ' at event guildMemberUpdate')) });
            }
        });
    }
});

client.on('guildBanAdd', function (guildBan) {
    //Notify moderators
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, guildBan.guild, 'guildBanAdd', guildBan.user, guildBan.guild)
        .catch(err=>{ tools.errorLog(tools.errorContext(err, ' at event guildBanAdd')) });
});

client.on('guildBanRemove', function (guildBan) {
    //Notify moderators
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, guildBan.guild, 'guildBanRemove', guildBan.user, guildBan.guild)
        .catch(err=>{ tools.errorLog(tools.errorContext(err, ' at event guildBanRemove')) });
});

client.on('guildMemberAdd', function (member) {
    business.welcomeNewMember(member);
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildMemberAdd', member)
        .catch(err=>{ tools.errorLog(tools.errorContext(err, ' at event guildMemberAdd')) });
});

client.on('guildMemberRemove', function (member) {
    if (member.user.id != client.user.id) {
        tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildMemberRemove', member)
            .catch(err=>{ tools.errorLog(tools.errorContext(err, ' at event guildMemberRemove')) });
    }
});

client.login(Token);
