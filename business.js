const tools = require('./tools');
const dao = require('./dao');
const { PermissionsBitField } = require('discord.js');
const personality = require('./personality');
const interactions = require('./interactions');

const OWNER = process.env.OWNER;


//Notify a new member in the dedicated welcome channel (if any)
async function welcomeNewMember(member){
    let res = await checkNewMember(member);
    if(res === 'ok'){
        raidProtection(member);
        addRolesToNewMember(member);
    }
}

//Check if new member is ok
async function checkNewMember(member){
    let res = 'ok';
    let currentGuildId = member.guild.id;
    let currentMemberId = member.id;
    //Check if the user is a registered offender
    let punishments = await dao.getPunishment(currentGuildId, currentMemberId).catch(function(err){
        console.error("getPunishment() "+err);
    });
    let punishment;
    if(punishments.rowCount === 0){
        punishment = '';
    }else{
        punishment = punishments.rows[0].punishment;
    }
    if(punishment == 'banned'){
        let res = await member.ban().catch(function(err){console.error('Banning error: '+err);});
        //No need to keep them in the databese now that they are banned.
        dao.removePunishment(currentGuildId,currentMemberId);
        res = 'banned';
    }else if(member.user.tag.includes('discord.gg/')||member.user.tag.includes('discordapp.com/')||member.user.tag.includes('discord.com/')){
        let res = await member.ban({ reason: 'Name contains an invite link' }).catch(function(err){
            tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'warn', 'Could detect potential raid but not ban user'+
                                          '\n User: '+member.user.tag+'\nReason: '+err);});
        tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildBanAdd', member.user, member.guild);
        res = 'banned';
    } else if(punishment == 'muted'){
        let role = await tools.findByName(member.guild.roles, 'Muted').catch(function(err){
            console.error(err);
            tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'warn', 'User is marked as muted but I couldn\'t mute them automatically'+
                                          '\n User: '+member.user.tag+'\nReason: '+err);
        });Ò
        member.roles.add(role,'Muted because on mute list.').catch(function(err){console.error('MUTE'+err);});
        res = 'muted';
    } else {
        //If the member isn't banned, check for other things
        let limitDate = member.user.createdAt;
        limitDate.setDate(limitDate.getDate() +1);
        if(new Date() < limitDate){
            let role = await tools.findByName(member.guild.roles, 'Muted').then(function(err){console.error(err);});
            member.roles.add(role,"Account is too young").catch(function(err){console.error('MUTE '+err);});
            res = 'muted';
            tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildMuteAdd', member);
        }
    }
    return res;
}

//TODO: Test function
async function raidProtection(member){
    let res = await dao.isFrozen(member.guild).catch(function(err){console.log('guildMemberAdd '+err);});
    let isFrozen = res.rows[0].is_frozen;
    if (isFrozen){
        let role = await tools.findByName(member.guild.roles, 'Muted').catch(function(err){console.error(err);});
        res = member.roles.add(role).catch(function(err){
            let message = 'Despite the raid, a mute role could not be given to user '+member.user.tag+' '+err;
            tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, client, 'warn', message);//TODO: Client unavailable
            console.error(message);
            return message;
        });
        member.user.createDM().then(function(DM){
            DM.send('Sorry for the inconvenience, the guild is facing difficulties and you\'ve been muted, a moderator should contact you shortly.').catch(function(err){
                console.error('Cannot send DM to '+member.user.tag+ ' '+err);
            });
        }, function(err){
            console.error(err);
        });
        tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, client, 'userFrozen', member);
    }
}

function updateGuilds(guilds){
    guilds.forEach(function (guild) {
        dao.updateGuild(guild.id, guild.name);
    });
}

/**
 * Replace a guild's information with the form body
 * @param {DOM form} body 
 */
function updateGuild(body){
    let numbersOnly = new RegExp(/[0-9]+/);
    let legalCharacters = new RegExp(/[^'"\\]+/);
    let isValid = (numbersOnly.test(body.guild)) 
        && (numbersOnly.test(body.welcome_channel) || !body.welcome_channel.length) 
        && (numbersOnly.test(body.information_channel) || !body.information_channel.length)
        && (numbersOnly.test(body.starboard_channel) || !body.starboard_channel.length)
        && (numbersOnly.test(body.nb_starboard) || !body.nb_starboard.length)
    let guildInfo = { welcomeChannel:body.welcome_channel || 0, 
            informationChannel:body.information_channel || 0,
            starboardChannel:body.starboard_channel || 0, 
            nbStarboard:body.nb_starboard || 0, 
            inactive:body.inactive && 1, frozen:body.frozen === 'true'};
    let nations = [];
    let deleted = [];
    if(!isValid)
        throw {name: 'invalidInputException', message: 'One of the elements in the form is illegal'};
        
    if(body.role && body.name){
        for(let i=0; i < body.role.length; i++){
            if(body.deleted[i] === 'true' ){//TODO: Delete nation
                deleted.push(body.role[i])
                continue;
            }
            isValid = isValid
            && (legalCharacters.test(body.name[i]))
            && (legalCharacters.test(body.description[i]) || !body.description[i].length)
            && (numbersOnly.test(body.role[i]))
            && (legalCharacters.test(body.thumbnail[i]) || !body.thumbnail[i].length);
            //try{
            nations.push({name:body.name[i], description:body.description[i], 
                thumbnail:body.thumbnail[i], role:body.role[i], deleted:body.deleted[i], isUnique:body.isUnique[i] === 'true'});
            //}catch(err){console.error(err)};
        }
    }
    
    if(isValid){
        dao.replaceGuild(body.guild, guildInfo);
        if(nations.length>0)
            dao.replaceNations(body.guild, nations);
        if(deleted.length>0)
            dao.removeNations(body.guild, deleted);
    }else{
        throw {name: 'invalidInputException', message: 'One of the elements in the form is illegal'};
    }
}

async function register(interaction){
    if (!interaction.inGuild()){
        if(interaction.user.id === OWNER)
            return await interactions.register();
        return 'This command is reserved to the bot owner';
    }else{
        if(interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return await interactions.register(interaction.guild);
        else 
            return 'This command is reserved to administrators';
    }
    
}

/**
 * Deletes all references in the database for guilds the bot left
 * @param {Interaction} interaction command interaction
 * @returns 
 */
async function prune(interaction){
    return await interaction.client.guilds.fetch().then(async function(guilds){
        if(interaction.user.id === OWNER)
            return await pruneGuilds(guilds, true);
        else
            return 'This command is reserved to the bot owner';
    });
}

/**
 * Detect unused guilds
 * @param {*} joinedGuilds List of all guilds the bot is in
 * @param {boolean} toDelete Wether or not to perform deletion
 */
async function pruneGuilds(joinedGuilds, toDelete){
    //Detect left guilds
    let result;
    if(toDelete)
        result = 'Guilds pruned from the database: \n';
    else
        result = 'The following guilds are unused: \n';
    let knownGuilds = await dao.getGuilds();
    knownGuilds.rows.forEach(function(dbGuild){
        let exists;
        joinedGuilds.forEach(function(joinedGuild){
            if(dbGuild.id === joinedGuild.id)
                exists = true;
        });
        if(!exists){
            result += `id: ${dbGuild.id}, name: ${dbGuild.name}\n`;
            if(toDelete)
                dao.removeGuild(dbGuild.id);
        }
    });
    return result;
}

//Welcome a new member, add roles if setup
function addRolesToNewMember(member){
    if(member != null){
        dao.getWelcomeChannel(member.guild).then(function(channel_id){
            dao.getInfoChannel(member.guild).then(function(info_id){
                let channel = member.guild.channels.cache.get(channel_id);
                let infoChannel = member.guild.channels.cache.get(info_id);
                if(channel !== undefined){
                    let string='';
                    if(infoChannel !== undefined){
                        string= ' Make sure to check the rules and get the roles you want in <#'+infoChannel.id+'>.';
                    }
                    channel.send('Welcome to '+channel.guild.name+', <@'+member.user.id+'>.'+string+' '+tools.randomWelcome());
                }else{
                    console.error('Channel not found');
                }
            }, function(err){
                console.error(err);
            });
        },function(err){
            console.error(err);
        });
    }else{
        console.error('Member is null');
    }
}

//Mute or unmute user
//TODO: Muted role by ID instead of name
async function muteUnmute(client, interaction){
    let message;
    if(interaction.member //Check if this is on a server
       && interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)){ 
        //Retrieve guild
        let guild = client.guilds.resolve(interaction.guildId);
        if(!guild){
            message = 'Error retrieving your guild with ID' + interaction.guildId;
            return message;
        }
        //Retrieve user
        let target = guild.members.resolve(interaction.targetId);
        if(!target){
            message = 'Error retrieving user with ID' + interaction.targetId;
            return message;
        }
        //Retrieve role
        let role = await tools.findByName(interaction.guild.roles, 'Muted').catch(function(err){
            console.error(err);
            message = 'No role named \'Muted\' have been found on this server';
            return message;
        });
        if (target._roles.includes(role.id)){
            //Unmute user
            await target.roles.remove(role,"Unmuted by "+interaction.user.username).then(function(res){
                message = 'User unmuted';
            },function(err){
                console.error('MUTE '+err);
                message = 'Error muting user: '+err;
                return message;
            });
        } else {
            //Mute user
            await target.roles.add(role,"Muted by "+interaction.user.username).then(function(res){
                message = 'User muted';
            },function(err){
                console.error('MUTE '+err);
                message = 'Error muting user: '+err;
                return message;
            });
        }
    }else{
        message = 'You are not allowed to mute or unmute this user here.';
    }
    return message;
}

//Displays a list of muted users
async function muteList(interaction){
    let mutedUsers = await dao.getMutes(interaction.guildId);
    let prettyList = '';
    mutedUsers.rows.forEach(function(row){
        prettyList += '<@' + row.id + '>\n';
    });
    return prettyList;
}

//Add or remove user from the notification whitelist
async function toggleWhitelist(member){
    let message;
    if(member){
        let whitelistedRows = await dao.getWhiteListedAdmins(member.guild);
        let whitelisted = whitelistedRows && whitelistedRows.rows.find(row => row.user == member.user.id);

        if(whitelisted){
            await dao.blacklistAdmin(member.user, member.guild).catch(function(err){
                message = 'Error: '+err;
                return message;
            });
            message = 'You will not receive generic notifications anymore.';

        }else if(member.permissions.has(PermissionsBitField.Flags.ManageMessages)){
            await dao.whitelistAdmin(member.user, member.guild).catch(function(err){
                message = 'Error: '+err;
                return message;
            });
            message = 'You will receive generic notifications.';
        }else{
            message = 'You are not allowed to use this command here.';
        }
    }else{
        message = 'You need to be in a server to perform this command.';
    }
    return message;
}

//Repeat a specified message
async function parrot(interaction){
    if(!interaction.isMessageComponent){
        return 'Error: Not a message component';
    }
    await interaction.deferReply({ephemeral: true});
    //Get the message with the fist two words removed
    let message = interaction.options.getString('text');
    let channel = interaction.options.getChannel('channel') ? interaction.options.getChannel('channel') : interaction.channel;
    if(message){
        await personality.sayWithDelay(message, channel).catch(function(err){
            console.error('PARROT '+err);
            return err;
        });
        return ('Message sent successfully');
    }else{
        return ('Please specify message');
    }
}

//Ban a user before they join
async function preban(interaction){
    if (interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)){
        let userId = interaction.options.getString('userid');
        let regex = new RegExp(/^\d{17,19}$/);
        let isSnowflake = regex.test(userId);
        if(isSnowflake){
            dao.addBan(interaction.guildId, userId);
            return 'User ' + userId + ' was banned from the server';
        }else{
            return 'Please enter a valid user ID';
        }
    }else{
        return 'You don\'t have sufficient permissions for this command';
    }
}

//Unbans a user
async function unban(interaction){
    if (interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)){
        let userId = interaction.options.getString('userid');
        let regex = new RegExp(/^\d{17,19}$/);
        let isSnowflake = regex.test(userId);
        if(isSnowflake){
            dao.unBan(interaction.guildId, userId);
            return 'User ' + userId + ' was unbanned';
        }else{
            return 'Please enter a valid user ID';
        }
    }else{
        return 'You don\'t have sufficient permissions for this command';
    }
}

module.exports = {
    muteUnmute: muteUnmute,
    muteList: muteList,
    parrot: parrot,
    preban: preban,
    prune: prune,
    pruneGuilds: pruneGuilds,
    register: register,
    toggleWhitelist: toggleWhitelist,
    unban: unban,
    updateGuilds: updateGuilds,
    updateGuild: updateGuild,
    welcomeNewMember: welcomeNewMember
}
