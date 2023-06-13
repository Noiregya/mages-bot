const tools = require('./tools');
const dao = require('./dao');
const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const personality = require('./personality');
const interactions = require('./interactions');
const { errors } = require('undici');

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
        let res = await member.ban({ reason: 'Name contains an invite link' }).then(
            function(res){
                tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildBanAdd', member.user, member.guild);
            },function(err){
            tools.permissionErrorNotifier(member.guild, PermissionsBitField.Flags.ManageMessages, 
                errorContext(err, `Could detect potential raid but not ban user, User: ${member.user.tag}`))
            });
        res = 'banned';
    } else if(punishment == 'muted'){
        let role = await tools.findByName(member.guild.roles, 'Muted').catch(function(err){
            console.error(err);
            tools.permissionErrorNotifier(member.guild, PermissionsBitField.Flags.ManageMessages, 
                errorContext(err, `User is marked as muted but I couldn't mute them automatically, User: ${member.user.tag}`));
        });
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
    let res = await dao.isFrozen(member.guild).catch(function(err){console.error('guildMemberAdd '+err);});
    let isFrozen = res.rows[0].is_frozen;
    if (isFrozen){
        let role = await tools.findByName(member.guild.roles, 'Muted').catch(function(err){console.error(err);});
        res = member.roles.add(role).catch(function(err){
            let message = 'Despite the raid, a mute role could not be given to user '+member.user.tag+' '+err;
            tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'warn', message);
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
        tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'userFrozen', member);
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
        && (legalCharacters.test(body.mute_role) || !body.mute_role.length)
    let guildInfo = { welcomeChannel:body.welcome_channel || 0, 
            informationChannel:body.information_channel || 0,
            starboardChannel:body.starboard_channel || 0, 
            nbStarboard:body.nb_starboard || 0, 
            inactive:body.inactive && 1, 
            muteRole:body.mute_role || 0,
            frozen:body.frozen === 'true'};
    if(!isValid)
        throw {name: 'invalidInputException', message: 'One of the elements in the server configuration is illegal'};
    //Turn values into arrays if they aren't
    if(!Array.isArray(body.role)){
        body.role = [body.role];
        body.name = [body.name];
        body.description = [body.description];
        body.thumbnail = [body.thumbnail];
        body.deleted = [body.deleted];
        body.isUnique = [body.isUnique];
    }
    let nations = [];
    let deleted = [];
    let a = body.role[0];

    if(body.role[0] && body.name[0]){
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
        if(nations.length>0){
            dao.replaceNations(body.guild, nations);
        }
        if(deleted.length>0)
            dao.removeNations(body.guild, deleted);
    }else{
        throw {name: 'invalidInputException', message: 'One of the elements in the nation configuration is illegal'};
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

async function updateMenu(interaction){ 
    let errors  = [];
    if (!interaction.inGuild())
        return 'This command is only usable in a guild';
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return 'You must be admin in this guild to use this command';
    let channels = await dao.getChannels(interaction.guildId);
    let informationChannelId;
    if(channels && channels.rows && channels.rows.length > 0)
        informationChannelId = channels.rows[0].information;
    if(!informationChannelId || informationChannelId.length<17)
        return 'Please select a channel in the configuration page to use this command';
    //Get existing message
    let messages = await dao.getMessages(interaction.guildId, 'nation');
    if(messages.rows.length > 0){//Delete if messages exist
        let messageChannel = await interaction.guild.channels.fetch(messages.rows[0].channel).catch(err => errors.push(tools.errorContext(err, 'at updateMenu')));
        for(message of messages.rows){
            messageChannel.messages.fetch(message.id)
                .then(fetched=>fetched.delete().catch(err=>{})).catch(err=>{});
        }
    }
    //Get nations
    let nations = await dao.getNations(interaction.guildId).catch(err => errors.push(tools.errorContext(err, 'at updateMenu')));
    if(nations.rows.length === 0)
        return 'Please add a nation in the configuration page to use this command';
    //Build response
    let informationChannel = await interaction.guild.channels.fetch(informationChannelId).catch(err => errors.push(tools.errorContext(err, 'at updateMenu')));
    if(!informationChannel)
        return 'The information channel couldn\'t be fetched, was it deleted?';
    let sentMessages = []
    for(nation of nations.rows){
        let discordRole = await interaction.guild.roles.resolve(nation.role);
        let color=0;
        if(discordRole)
            color = discordRole.color;
        let embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(nation.name)
        .setFooter({ text: nation.isunique ? 'Join only one' : 'Join as many as you want'});
        if(nation.description)
            embed = embed.setDescription(nation.description);
        if(nation.thumbnail)
            embed = embed.setThumbnail(nation.thumbnail);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nation_${nation.role}`)
                .setLabel('Join/leave nation')
                .setStyle(nation.isunique ? ButtonStyle.Success : ButtonStyle.Primary),
        );
        message = await informationChannel.send({embeds: [embed], components: [row] }).catch(err => errors.push(tools.errorContext(err, 'at updateMenu')));
        sentMessages.push(message.id);
    };
    if(sentMessages.length>0)
        dao.replaceMessages(informationChannel.guildId, informationChannel.id, sentMessages, 'nation');

    const messageShare = await updateNationShares(interaction.guild, {toDelete:true, toCreate:true});

    //tools.permissionErrorNotifier(interaction.guild, PermissionsBitField.Flags.Administrator, errors);
    if(errors.length>0)
        return tools.errorLog(errors);
    return messageShare+'\nMenu updated successfully';
}

/**
 * Update the message that displays the shares
 * @param {*} guild 
 * @param {*} options {toDelete: Delete the current message to replace it, toCreate: Create a new message if it doesn't exist}
 * @returns human readable status string
 */
async function updateNationShares(guild, options){
    if(!options)
        options = {};
    let errors = [];
    let channels = await dao.getChannels(guild.id);
    let informationChannelId;
    if(channels && channels.rows && channels.rows.length > 0)
        informationChannelId = channels.rows[0].information;
    if(!informationChannelId || informationChannelId.length<17)
        return 'Please select a channel in the configuration page to use this command';
    let informationChannel = await guild.channels.fetch(informationChannelId).catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
    if(!informationChannel)
        return 'The information channel couldn\'t be fetched, was it deleted?';
    //Get existing share message
    messages = await dao.getMessages(guild.id, 'shares');

    let shareMessage;
    if(messages.rows.length > 0){
        let messageChannel = await guild.channels.fetch(messages.rows[0].channel).catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
        for(message of messages.rows){
            shareMessage = await messageChannel.messages.fetch(message.id).catch(err=>{});
            if(options.toDelete)
                await shareMessage.delete().catch(err=>{errors.push(tools.errorContext(err, ' at updateNationShares'))})
        }
    }

    //Generate the new share message
    let shareRes = await generateNationShares(guild).catch(err=>{errors.push(tools.errorContext(err, 'at updateNationShares'))});

    let sentSareMessage;
    if(shareMessage && !options.toDelete)
        sentSareMessage = await shareMessage.edit({embeds: [shareRes]}).catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
    else if(options.toCreate)
        sentSareMessage = await informationChannel.send({embeds: [shareRes]}).catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
    if(sentSareMessage)
        dao.replaceMessages(informationChannel.guildId, informationChannel.id, sentSareMessage.id, 'shares');
    
    if(errors.length>0)
        return tools.errorLog(errors);
    return 'Nations updated successfully';
}

async function generateNationShares(guild){
    let nations = await dao.getNations(guild.id).catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
    let members = await guild.members.fetch().catch(err => errors.push(tools.errorContext(err, 'at updateNationShares')));
        
    if(!nations || !members)
        return new Error('Couldn\'t fetch everything needed for nation shares');
    //let shares = [];
    let total = 0;
    let anything = false;
    for(i=0; i< nations.rows.length; i++){
        if(nations.rows[i].isunique){
            nations.rows[i].number = 0;
            anything = true;
        }
            
    }
    if(anything){
        members.forEach(member => {
            for(i=0; i<nations.rows.length; i++){
                const role = member.roles.resolve(nations.rows[i].role);
                if(role && nations.rows[i].isunique){
                    nations.rows[i].number += 1;
                    total += 1;
                    break;
                }
            }
        });
    }
    if(!total)//No nation or users in nations
        return {
            color: 0x7F20AF,
            title: 'Create and join nations to see shares!',
            timestamp: new Date().toISOString()
        };
    let fieldsArray = [];
    for(nationShare of nations.rows){
        if(nationShare.isunique){
            fieldsArray.push({
                name: nationShare.name,
                value: "Shares: "+Math.round((nationShare.number*100)/total)+"%"
            });
        }
    }
    const embed = new EmbedBuilder()
        .setColor(0x7F20AF)
        .setTitle('This dimension\'s shares')
        .setTimestamp(new Date())
        .setDescription('See the current nation shares below')
        .setFields(fieldsArray);
    return embed;
}

/**
 * Make a user join or leave a nation (and leave other unique nations)
 * @param {*} interaction
 */
async function toggleNation(interaction){
    let errors = [];
    let res = 'Nation left!';
    let clickedRole = interaction.customId.split('_')[1];
    let roles = await interaction.member.roles;
    let nations =  await dao.getNations(interaction.guild.id);
    let clickedNation = nations.rows.find(nation => nation.role === clickedRole);
    if(nations.rows.some(nation => nation.role === clickedRole)){
        let same = false;
        for(nation of nations.rows){
            const role = roles.resolve(nation.role);
            if(role){
                same = same || (clickedRole === role.id);
                if((nation.isunique && clickedNation.isunique) || same){
                    roles.remove(nation.role).catch(err=> errors.push(tools.errorContext(err,'at toggleNation')));
                    if(same)
                        break;
                }
            }
        };
        if(!same){
            await interaction.member.roles.add(clickedRole);
            res = 'Nation joined!' 
        }
    }
    if(errors.length > 0)
        tools.permissionErrorNotifier(interaction.guild, PermissionsBitField.Flags.Administrator, errors);
    return res;
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
    let any = false;
    knownGuilds.rows.forEach(function(dbGuild){
        let exists;
        joinedGuilds.forEach(function(joinedGuild){
            if(dbGuild.id === joinedGuild.id)
                exists = true;
        });
        if(!exists){
            result += `id: ${dbGuild.id}, name: ${dbGuild.name}\n`;
            any = true;
            if(toDelete)
                dao.removeGuild(dbGuild.id);
        }
    });
    return any ? result : 'All current guilds are being used';
}

//Welcome a new member
function addRolesToNewMember(member){//TODO: Rename function
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
        let roleId = await dao.getGuildProperties([interaction.guildId]);
        roleId = roleId.rows[0].mute_role;
        let roles = await interaction.guild.roles;
        let role = roles.resolve(roleId);

        if (!role)
            return 'A mute role have not been defined for this guild. Set one in the admin page.';
        if (target._roles.includes(role.id)){
            //Unmute user
            await target.roles.remove(role,"Unmuted by "+interaction.user.username).then(function(res){
                dao.removePunishment(guild.id, target.id);
                message = 'User unmuted';
            },function(err){
                console.error('MUTE '+err);
                message = 'Error muting user: '+err;
                return message;
            });
        } else {
            //Mute user
            await target.roles.add(role,"Muted by "+interaction.user.username).then(function(res){
                dao.addMute(guild.id, target.id);
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
    if(mutedUsers.rows.length < 1)
        return 'No user muted by the bot in this guild';
    let prettyList = '';
    for(row of mutedUsers.rows){
        prettyList += '<@' + row.id + '>\n';
    }
    return prettyList;
}

//Add or remove user from the notification whitelist
async function toggleWhitelist(member){
    let message;
    if(member){
        let whitelistedRows = await dao.getWhiteListedAdmins(member.guild.id);
        let whitelisted = whitelistedRows && whitelistedRows.rows.find(row => row.id == member.user.id);
        if(whitelisted){
            await dao.blacklistAdmin(member.user.id, member.guild.id).catch(function(err){
                message = 'Error: '+err;
                return message;
            });
            message = 'You will not receive generic notifications anymore.';

        }else if(member.permissions.has(PermissionsBitField.Flags.ManageMessages)){
            await dao.whitelistAdmin(member.user.id, member.guild.id, member.user.tag).catch(function(err){
                message = 'Error: '+err;
                return message;
            });
            message = 'You will receive generic notifications.';
        }else{
            message = 'You are not allowed to use this command here.';
        }
    }else{
        message = 'You need to be in a guild to perform this command.';
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
    toggleNation: toggleNation,
    muteUnmute: muteUnmute,
    muteList: muteList,
    parrot: parrot,
    preban: preban,
    prune: prune,
    pruneGuilds: pruneGuilds,
    register: register,
    toggleWhitelist: toggleWhitelist,
    unban: unban,
    updateMenu: updateMenu,
    updateNationShares: updateNationShares,
    updateGuilds: updateGuilds,
    updateGuild: updateGuild,
    welcomeNewMember: welcomeNewMember
}
