const { Client, Events, GatewayIntentBits, PermissionsBitField } = require('discord.js');

//Discord intents
const client = new Client({ intents: [
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
] });

const Token = process.env.TOKEN;
const Owner = process.env.OWNER;
var ownerUser;
const tools = require('./tools');
const dao = require('./dao');
const business = require('./business');
const personality = require('./personality');
const interactions = require('./interactions');
const webpage = require('./webpage.js');
const intervalStarted = false;
const dayInMS = 86400000;

const HELP_MESSAGE = tools.help;

var deleteAllInAChannel = tools.deleteAllInAChannel;
var deleteOneInAChannel = tools.deleteOneInAChannel;
var calculateYesterday = tools.calculateYesterday;
var sleep = tools.sleep;
var inRaid = false;
var activeRole = null;

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
client.on('ready', function(){
    //Initialize client
    client.application.fetch().then(function(application){
        ownerUser = application.owner;
        console.log('Welcome to MAGES.'+'\nOwner: '+ownerUser.tag);
        ownerUser.createDM().then(DMchannel =>{
            DMchannel.send("I had to restart, remember to check the logs if you don't know why!").catch(err =>{
                console.error(err);
            });
        }), err =>{console.error(err)};
    }).catch(err => {console.error(err)});


    console.log('Logged in as '+client.user.tag+'!');
    client.user.setActivity(".P HELP",{ type: 'LISTENING' });
    client.guilds.fetch().then(function(guilds){
        if(guilds.available)
            guilds = new Array(guilds);
        guilds.forEach(function (guild){
            console.log('Available guild '+guild.name)
        })
    });
    //TODO cache messages to fix starboard?
    /*.cache.array().forEach(function(guild){//cache channel messages to allow reaction/logs
        dao.getInfoChannel(guild).then(function(infoChannel){
            let channel = guild.channels.cache.get(infoChannel);
            if(channel!== null){
                channel.messages.fetch().then(
                    function(messages){
                        console.log('Fetched '+messages.size+' messages from '+guild.name);
                    }, function(err){console.error(err);});
            }
        }, function(err){console.error("Caching "+err);});
    });*/
    //TODO: Periodic check for share messages
    /*client.setInterval(function(){
        client.guilds.cache.array().forEach(function(thisguild){
            tools.updateShareMessage(thisguild);
        });
    }, 300000);

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
    if(interaction.isChatInputCommand()){
        switch (String(interaction.commandName)){
            case 'mute':
                await interaction.reply({ content: 'This should be the list of muted users', ephemeral: true });
                break;
            case 'whitelist':
                res = await business.toggleWhitelist(interaction.member);
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'parrot':
                res = await business.parrot(interaction);
                if(interaction.deferred)
                    interaction.editReply(res);
                else
                    interaction.reply({ content: res, ephemeral: true });
                break;
            case 'register':
                if(interaction.inGuild())
                    res = await interactions.register(interaction.guild);
                else //TODO: Check if the command was issued by the bot owner
                    res = await interactions.register();
                await interaction.reply({ content: res, ephemeral: true });
                break;
            case 'preban':
                res = await business.preban(interaction);
                await interaction.reply({ content: res, ephemeral: true});
                break;
            case 'unban':
                res = await business.unban(interaction);
                await interaction.reply({ content: res, ephemeral: true});
                break;
        }
    }else if(interaction.isUserContextMenuCommand()){
        switch (String(interaction.commandName)){
            case 'toggle mute':
                res = await business.muteUnmute(client, interaction);
                interaction.reply({ content: res, ephemeral: true });
                break;
            case 'register':
                res = await interactions.register();
                await interaction.reply({ content: res, ephemeral: true });
                break;
        }        
    }else if(interaction.isMessageContextMenuCommand()){
        //Message context menu commands
    }

});
//TODO: Variablilize events
client.on('warn',function(warn){
    tools.genericEventNotifier(ownerUser, 'warn', warn);
});
client.on('error',function(error){
    tools.genericEventNotifier(ownerUser, 'error', error);
});
client.on('guildCreate',function(guild){
    tools.genericEventNotifier(ownerUser, 'guildCreate', guild);
    dao.registerGuild(guild);
});
client.on('guildDelete',function(guild){
    tools.genericEventNotifier(ownerUser, 'guildDelete', guild);
});

client.on('guildMemberUpdate',function(oldMember, newMember){
    //Calculate differences
    let roleRemoved = oldMember._roles.filter(x => !newMember._roles.includes(x));
    let roleAdded = newMember._roles.filter(x => !oldMember._roles.includes(x));
    //Roles has been added
    if(roleAdded.length > 0){
        roleAdded.every(function(role){
            //Check if one of the added role is a mod role, if they can manage messages
            if(!oldMember.permissions.has(PermissionsBitField.Flags.ManageMessages) && 
               newMember.permissions.has(PermissionsBitField.Flags.ManageMessages)){
                newMember.user.createDM().then(function(DM){
                    DM.send('You received a role that makes you eligible to notifications for '+newMember.guild.name+'. To receive notifications, '+
                            'type /whitelist').catch(function(err){console.error(err);});
                },function(err){console.error(err);});
            }
        }); 
    }
});

client.on('guildBanAdd',function(guildBan){
    //Notify moderators
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, guildBan.guild, 'guildBanAdd', guildBan.user, guildBan.guild).then(function(res){
        console.debug(res);
    });
});

client.on('guildBanRemove',function(guildBan){
    //Notify moderators
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, guildBan.guild, 'guildBanRemove', guildBan.user, guildBan.guild).then(function(res){
        console.debug(res);
    });
});

client.on('guildMemberAdd',function(member){
    business.welcomeNewMember(member);
    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildMemberAdd', member).then(function(res){
        console.debug(res);
    });
});

client.on('guildMemberRemove',function(member){
    if(member.user.id != client.user.id){
        tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, member.guild, 'guildMemberRemove', member).then(function(res){
            console.debug(res);
        });
    }else{
        console.error('I cannot notify my own leave');
    }
});

//TODO: Join nations message with buttons
//TODO: MessageReactionAddEvent
/* 
client.on('messageReactionAdd', function(messageReaction, user){
    let message = messageReaction.message;
    let guild = message.guild;
    //Check if it's in a guild and don't react to own reacts
    if(guild && user != client.user){
        let member = guild.members.resolve(user);
        if(messageReaction.emoji.name === '⭐' &&  !message.reactions.resolve('🌟')){
            dao.getStarAmount(guild).then(function(amount){
                if(amount > 0 && messageReaction.count >= amount){
                    message.react('🌟').catch(function(err){console.error("on messageReactionAdd add react "+err);});
                    dao.getStarboardChannel(guild).then(function(starboardchannel) {
                        let channel = guild.channels.cache.get(starboardchannel);
                        if(channel && !message.channel.nsfw){
                            tools.convertMessageToEmbed(messageReaction.message, '⭐ ').then(function(embed){
                                embed.forEach(function(element){
                                    channel.send(element).catch(function(err){console.error(err);});
                                });
                            },function(err){console.error("messageReactionAdd "+err);});
                        }else{
                            message.pin().catch(function(err){console.error("messageReactionAdd pinning message "+err);});
                        }
                    }, function(err){console.error("messageReactionAdd "+err);});
                }
            }, function(err){console.error("messageReactionAdd "+err);});
        }
        dao.getInfoChannel(guild).then(function(infoChannel){
            //Check if it's in the info channel
            if(message.channel.id == infoChannel){
                dao.getNations(guild).then(function(result){
                    result.rows.forEach(function(row){
                        if(row.message_id == message.id){
                            tools.findByName(guild.roles, row.name).then(function(role){
                                tools.joinNation(role, member, result.rows);
                                if(row.isunique){
                                    result.rows.forEach(function(doubleCheck){
                                        if(doubleCheck.isunique && doubleCheck.message_id != message.id){//Every nation message except the requested one
                                            let suspectMessage = message.channel.messages.resolve(doubleCheck.message_id);
                                            if(suspectMessage === undefined){
                                                tools.genericEventNotifier(ownerUser, 'warn', 'Unable to fetch reactable info message, please reload the info messages on '+messageReaction.message.guild);
                                            }else{
                                                //Remove unneeded reactions
                                                suspectMessage.reactions.cache.array().forEach(function(reaction){
                                                    reaction.users.remove(user).catch(function(err){
                                                        //Silent error
                                                    });
                                                });
                                            }
                                        }
                                    });
                                }
                            }, function(err){console.error(err);});                            
                        }
                    });
                }, function(err){
                    console.error("Could not get nations properly: "+err);
                }).catch(function(err){console.error(err);});
            }else{
                //do nothing for now
            }
        }, function(err){
            console.error('messageReactionAdd '+err);
        });
        dao.getEventNations(guild).then(function(result){
            const filteredEvents = result.rows.filter(element => element.channel == message.channel.id)
            result.rows.forEach(function(row){
                if(row.message_id == message.id){
                    tools.findByName(guild.roles, row.name).then(function(role){
                        tools.joinNation(role, member, result.rows);
                        if(row.isunique){
                            result.rows.forEach(function(doubleCheck){
                                if(doubleCheck.isunique && doubleCheck.message_id != message.id){//Every nation message except the requested one
                                    let suspectMessage = message.channel.messages.resolve(doubleCheck.message_id);
                                    if(suspectMessage === undefined){
                                        tools.genericEventNotifier(ownerUser, 'warn', 'Unable to fetch reactable info message, please reload the info messages on '+messageReaction.message.guild);
                                    }else{
                                        //Remove unneeded reactions
                                        suspectMessage.reactions.cache.array().forEach(function(reaction){
                                            reaction.users.remove(user).catch(function(err){
                                                //Silent error
                                            });
                                        });
                                    }
                                }
                            });
                        }
                    }, function(err){console.error(err);});                            
                }
            });
        }, function(err){
            console.error("Could not get event nations properly: "+err);
        }).catch(function(err){console.error(err);});
    }
});
*/

//Replace with leave nation event
/*
client.on('messageReactionRemove', function(messageReaction, user){
    let guild = messageReaction.message.guild;
    if(guild){
        guild.members.fetch(user).then(function(member){
            dao.getNations(guild).then(function(result){
                result.rows.forEach(function(row){
                    if(row.message_id == messageReaction.message.id){
                        tools.findByName(guild.roles, row.name).then(function(role){
                            tools.leaveNation(role, member, result.rows);
                        });
                    }
                });
            }).catch(function(err){
                console.error("Could not get nations properly: "+err);
            });
        }, function(err){
            console.error("Could not fetch member properly: "+err);
        });    
    }
});
*/

//TODO: React to message for personality
/*
client.on('messageUpdate', function(oldMessage, newMessage){
    if(oldMessage.content != newMessage.content && newMessage.author.id != client.user.id){
        personality.reactToMessage(client, newMessage);
    }
});
*/

//TODO: List muted users
//TODO: Create polls
//TODO: Auto administration
//TODO: New permission management for guild admins
//TODO: Web interface setup
    //TODO: Starboard
    //TODO: Permissions
    //TODO: Welcome channel
    //TODO: Nations
    //TODO: Pin channel
//TODO: SECURE COMMAND equivalent: copies pinned messages to a pin channel
//TODO: Activity monitor: Keep track of active users to prune inactive ones
//TODO: RELOAD COMMAND EQUIVALENT: Send necessary messages in the welcome channel
//TODO: FREEZE/UNFREEZE server: Mutes all new users in case of a raid
//Everyone's messages watch
/*
client.on('message', function(msg){
    if(msg.content && msg.author.id != client.user.id){
        personality.reactToMessage(client, msg);
        //Parse message
        var parsedMessage = tools.parseMessage(msg.content);
        //Activity update
        if(msg.guild !== undefined && msg.author && msg.member){
            dao.getActiveRoles(msg.guild, true).then(function(activeRole){
                if(msg.member.roles.cache.get(activeRole[0]) === null && activeRole[0]!== null && !msg.member.user.bot){
                    msg.member.roles.add(activeRole[0]).catch(function(err){console.error("ActivityUpdate "+err);});
                }
            }, function(err){console.err("ActivityUpdate "+err);});
        }

        //var currentMessage = msg.content.split(" ");
        if(parsedMessage.length >=2 ){
            if (parsedMessage[0].toUpperCase() == ('.P')){
                if (parsedMessage[1].toUpperCase() === 'PING') {
                    msg.reply('Have you found the Doc. P?').catch(function(err){
                        console.error("PING "+err);
                    });
                } else if (parsedMessage[1].toUpperCase() === 'HELP') {
                    msg.author.createDM().then(function(value){
                        if(parsedMessage.length>=3 && parsedMessage[2].toUpperCase() !== 'HERE'){
                            switch(parsedMessage[2].toUpperCase()){
                                case "CREATENATION":
                                case "CREATEEVENTNATION":
                                case "CREATESECRETROOM":
                                    value.send(tools.helpCreateNation).catch(function(err){console.error("HELP "+err);});
                                    break;
                                case "LEVELS":
                                    value.send(tools.helpLevels).catch(function(err){console.error("HELP "+err);});
                                    break;
                                case "ASSIGN":
                                    value.send(tools.helpAssign).catch(function(err){console.error("HELP "+err);});
                                    break;
                                default:
                                    value.send("Cannot provide details on command "+parsedMessage[2]).catch(function(err){console.error("HELP "+err);});
                            }
                        }else {
                            if(parsedMessage.length>=3 && parsedMessage[2].toUpperCase() === 'HERE'){
                                value = msg.channel;
                            }
                            HELP_MESSAGE.forEach(function(help){
                                value.send(help).catch(function(err){console.error("HELP "+err);});
                            });
                        }
                    },function(err){
                        console.err('HELP: '+err); 
                    });
                } else if (parsedMessage[1].toUpperCase() == 'SNOOZE' && parsedMessage.length == 4) {
                    let snoozetime = parseInt(parsedMessage[3], 10)*60000;
                    if(!Number.isNaN(snoozetime)){
                        msg.author.createDM().then(function(dm){
                            dm.send(parsedMessage[2]+" in "+parsedMessage[3]+" minutes").catch(function(err){console.error('SNOOZE '+err);});
                        }, function(err){
                            console.error('SNOOZE '+err);
                        });
                        let targetDate = Date.now() + snoozetime;//generate the full date at which the event shall be consumed
                        let messageEvent = tools.createTimedMessageEvent(targetDate, msg.channel, `${msg.author} ${parsedMessage[2]}`);
                        tools.submitTimedEvent(client, messageEvent);
                    }
                }
                if(msg.member !== null){
                    dao.getLocalPowerLevels(msg.guild).then(function(powerLevels){
                        var bestPower = 99;
                        powerLevels.rows.forEach(function(role){
                            var fetchedRole = msg.member.roles.cache.get(role.role);
                            if(fetchedRole !== null && fetchedRole !== undefined && fetchedRole.name !== null && role.powerlevel<bestPower){
                                bestPower = role.powerlevel;
                            }
                        });
                        if(msg.member == msg.guild.owner||bestPower<=1){
                            if(parsedMessage[1].toUpperCase()==='ASSIGN'){
                                if(parsedMessage.length>=4){
                                    let requestedPower = parseInt(parsedMessage[2], 10);
                                    let currentRole;
                                    if(msg.mentions.roles.array().length==1){
                                        currentRole = msg.mentions.roles.array()[0];
                                    } else{
                                        msg.reply('Please use a valid role mention').catch(function(err){console.error('ASSIGN '+err);});
                                    }
                                    if(currentRole!== null && !Number.isNaN(requestedPower)){
                                        dao.assignBotRights(msg.guild, currentRole, requestedPower);
                                        msg.reply(currentRole.name+'s are now level '+requestedPower).catch(function(err){console.error('ASSIGN '+err);});
                                    }else{
                                        msg.reply('Please enter a valid number').catch(function(err){console.error('ASSIGN '+err);});
                                    }
                                }else{
                                    msg.reply('Invalid command, see .p help assign for more info').catch(function(err){console.error('ASSIGN '+err);});
                                }
                            }else if(parsedMessage[1].toUpperCase()=='AUTOASSIGN' && parsedMessage.length >=3){
                                if(parsedMessage[2].toUpperCase()=='ENABLE'){
                                    dao.enableNationJoin(msg.guild);
                                    msg.reply('One of the nation will be assigned to any newcommer').catch(function(err){
                                        console.error('Enable autoassign: '+err);
                                    });
                                }else if(parsedMessage[2].toUpperCase()=='DISABLE'){
                                    dao.disableNationJoin(msg.guild);
                                    msg.reply('No nation will be assigned to any newcommer').catch(function(err){
                                        console.error('Disable autoassign: '+err);
                                    });
                                }
                            }else if (parsedMessage[1].toUpperCase()=='SETSTARAMOUNT') {
                                let amount = parseInt(parsedMessage[2],10) || 0;
                                dao.setStarAmount(msg.guild, amount);
                            }else if(parsedMessage[1].toUpperCase()=='SETSTARBOARDCHANNEL'){
                                let parsedMentions = msg.mentions.channels.array();
                                dao.setStarboardChannel(msg.guild, parsedMentions[0]||"");
                            }else if(parsedMessage[1].toUpperCase()=='SETACTIVEROLE' && parsedMessage.length >=3){
                                let parsedMentions = msg.mentions.roles.array();
                                dao.updateActiveRole(msg.guild.id, parsedMentions);
                            }else if (parsedMessage[1].toUpperCase()=='SETDEFAULTACTIVEROLE') {
                                let parsedMentions = msg.mentions.roles.array();
                                dao.setDefaultActiveRole(msg.guild, parsedMentions[0]);
                            }else if (parsedMessage[1].toUpperCase()=='CLEARACTIVEROLE') {
                                dao.clearActiveRole(msg.guild);
                            }else if (parsedMessage[1].toUpperCase()=='SETACTIVEDELAY' && parsedMessage.length >=3) {
                                let delay = parseInt(parsedMessage[2], 10);
                                if(!Number.isNaN(delay)||delay>=1){
                                    dao.updateActiveDelay(msg.guild, delay);
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send("Delay updated to "+delay+" days").catch(function(err){console.error('SETACTIVEDELAY '+err);});
                                    }, function(err){
                                        console.error(err);
                                    });
                                }	else{
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send("Invalid delay entered.").catch(function(err){console.error('SETACTIVEDELAY '+err);});
                                    }, function(err){
                                        console.error(err);
                                    });
                                }
                            }
                        }
                        if(msg.member == msg.guild.owner||bestPower<=2){
                            if (parsedMessage[1].toUpperCase() === 'SECURE' && parsedMessage.length >= 3){
                                console.log('Securing pinned messages...');
                                msg.guild.channels.fetch(); //needed or the object won't be accessible
                                let targetChannel;
                                if(parsedMessage[2].startsWith('<#')){
                                    targetChannel = msg.guild.channels.cache.get(parsedMessage[2].substring(2, 20));
                                }else{
                                    targetChannel = msg.guild.channels.cache.get(parsedMessage[2]);
                                }
                                msg.channel.fetchPinnedMessages().then(function(pinnedMessages){
                                    let pinnedArray = pinnedMessages.array();
                                    let i = pinnedArray.length - 1;
                                    let notLast = false;
                                    if (parsedMessage.length >= 4 ){
                                        if (parsedMessage[3].toUpperCase() === 'NOLAST'){
                                            notLast = true;
                                        }
                                    }
                                    tools.sendNext(pinnedArray ,i ,notLast ,targetChannel);
                                }, function(err){
                                    console.error("SECURE "+err);
                                });
                            }
                            else if (parsedMessage[1].toUpperCase() == 'SETINFOCHANNEL'){
                                dao.setInfoChannel(msg.channel);
                                msg.author.createDM().then(function(DMChannel){
                                    DMChannel.send(msg.channel.name+' is the new information channel for '+msg.guild.name).catch(function(err){console.error('SETINFOCHANNEL '+err);});
                                }, function(err){
                                    console.error(err);
                                });
                                msg.delete().catch(function(err){
                                    console.error(err);
                                });
                            } else if (parsedMessage[1].toUpperCase() == 'SETWELCOMECHANNEL'){
                                dao.setWelcomeChannel(msg.channel);
                                msg.author.createDM().then(function(DMChannel){
                                    DMChannel.send(msg.channel.name+' is the new welcome channel for '+msg.guild.name).catch(function(err){console.error('SETWELCOMECHANNEL '+err);});
                                }, function(err){
                                    console.error(err);
                                });
                                msg.delete().catch(function(err){
                                    console.error(err);
                                });
                            } else if (parsedMessage[1].toUpperCase() == 'RELOAD') {
                                dao.getInfoChannel(msg.guild).then(function(info_id){
                                    let channel = msg.guild.channels.cache.get(info_id);
                                    if(channel !== undefined){
                                        tools.updateInfoMessage(channel, client.user, dao);
                                    }else{
                                        msg.reply('Fatal: No info channel found, try setting the info channel with .p setInfoChannel').catch(function(err){console.error('RELOAD '+err);});
                                    }
                                },function(err){
                                    console.error('Getting info channel '+err);
                                });
                            }else if (parsedMessage[1].toUpperCase()==('CLEAR')) {
                                let channels = msg.mentions.channels;
                                let members = msg.mentions.members;
                                if(members === null){
                                    msg.reply("Please choose at least one valid user").catch(function(err){console.error('CLEAR '+err);});
                                } else if(channels === null){
                                    msg.reply("Please choose at least one valid Text channel").catch(function(err){console.error('CLEAR '+err);});
                                }else{
                                    channels.forEach(function(channel){
                                        deleteAllInAChannel(channel, members);
                                    });
                                }
                            }else if (parsedMessage[1].toUpperCase()==('CREATENATION')||parsedMessage[1].toUpperCase()==('CREATESECRETROOM')) {
                                switch(parsedMessage.length){
                                    case 5:
                                        parsedMessage.push('unset');
                                        // falls through 
                                    case 6:
                                        tools.findByName(msg.guild.roles, parsedMessage[2]).then(function(role){
                                            if(role === undefined){
                                                msg.reply("Role "+parsedMessage[2]+" doesn't exist").catch(function(err){console.error('CREATENATION '+err);});
                                            }else{
                                                if(parsedMessage[1].toUpperCase()==('CREATENATION')){
                                                    dao.createNation(parsedMessage[2],parsedMessage[3],parsedMessage[4],parsedMessage[5], role, true).then(function(res){
                                                        msg.reply('Nation '+parsedMessage[2]+' created').catch(function(err){console.error('CREATENATION '+err);
                                                                                                                            });
                                                    });
                                                }else{
                                                    dao.createNation(parsedMessage[2],parsedMessage[3],parsedMessage[4],parsedMessage[5], role, false).then(function(res){
                                                        msg.reply('Secret room '+parsedMessage[2]+' created').catch(function(err){console.error('CREATESECRETROOM '+err);
                                                                                                                                 });
                                                    });
                                                }}
                                        }, function(err){console.error(err);});
                                        break;
                                    default:
                                        msg.reply("Invalid command, type .p help createnation for more info").catch(function(err){console.error('CREATENATION '+err);});
                                }
                            }else if(parsedMessage[1].toUpperCase()=='REMOVENATION'){
                                if(parsedMessage.length == 3){
                                    dao.removeNation(msg.guild, parsedMessage[2]).then(function(res){
                                        msg.reply("Nation "+parsedMessage[2]+" removed");
                                    });
                                }else{
                                    msg.reply("Invalid command, type .p help for more info").catch(function(err){console.error('REMOVENATION '+err);});
                                }
                            }else if (parsedMessage[1].toUpperCase()==('CREATEEVENTNATION')) {
                                switch(parsedMessage.length){
                                    case 7:
                                        tools.findByName(msg.guild.roles, parsedMessage[2]).then(function(role){
                                            if(role === undefined){
                                                msg.reply("Role "+parsedMessage[2]+" doesn't exist").catch(function(err){console.error('CREATEEVENTNATION '+err);});
                                            }else{
                                                dao.createEventNation(parsedMessage[2],parsedMessage[3],parsedMessage[4],parsedMessage[5],parsedMessage[6], role, true).then(function(res){
                                                    msg.reply('Event nation '+parsedMessage[2]+' created').catch(function(err){console.error('CREATEEVENTNATION '+err);
                                                                                                                              });
                                                });
                                            }
                                        }, function(err){console.error(err);});
                                        break;
                                    default:
                                        msg.reply("Invalid command, type .p help createeventnation for more info").catch(function(err){console.error('CREATEEVENTNATION '+err);});
                                }
                            }else if(parsedMessage[1].toUpperCase()=='REMOVEEVENTNATION'){
                                if(parsedMessage.length == 3){
                                    dao.removeEventNation(msg.guild, parsedMessage[2]).then(function(res){
                                        msg.reply("Event nation "+parsedMessage[2]+" removed");
                                    });
                                }else{
                                    msg.reply("Invalid command, type .p help for more info").catch(function(err){console.error('REMOVEEVENTNATION '+err);});
                                }
                            }
                        }
                        if (msg.member == msg.guild.owner||bestPower<=3){
                            if(parsedMessage[1].toUpperCase()=='SENDTOSTARBOARD'){
                                if(parsedMessage.length >= 4){
                                    dao.getStarboardChannel(msg.guild).then(function(starboardchannel) {
                                        let channel = msg.guild.channels.cache.get(starboardchannel);
                                        var targetChannel = tools.resolveChannelString(msg.guild, parsedMessage[2]);
                                        let myMessage = targetChannel.messages.resolve(parsedMessage[3]);
                                        tools.convertMessageToEmbed(myMessage, '⭐ ').then(function(embed){
                                        embed.forEach(function(element){
                                            channel.send(element).catch(function(err){console.error(err);});
                                        });
                                        },function(err){console.error("SENDTOSTARBOARD "+err);});
                                    });

                                } 
                            }else if(parsedMessage[1].toUpperCase() == 'PARROT'){
                                if (parsedMessage.length >= 4){
                                    try{
                                        var targetChannel = tools.resolveChannelString(msg.guild, parsedMessage[2]);
                                        let messageToProcess = parsedMessage.slice(3,parsedMessage.length);
                                        var answer = "";
                                        messageToProcess.forEach((item) => {
                                            answer += item + " ";
                                        });
                                        if(targetChannel !== undefined){
                                            personality.sayWithDelay(answer, targetChannel).catch(function(err){console.error('PARROT '+err);});
                                        }
                                    }catch (err){
                                        msg.reply("An error occured "+err.message);
                                    }
                                }
                            }
                            // On MUTE 
                            else if(parsedMessage[1].toUpperCase() == 'MUTE'){
                                if (parsedMessage.length == 4){
                                    var member = msg.guild.members.resolve(parsedMessage[3]);
                                    //We want to add a mute
                                    if(parsedMessage[2].toUpperCase() == 'ADD'){
                                        if(member !== null){
                                            tools.findByName(msg.guild.roles, 'Muted').then(function(role){
                                                member.roles.add(role,"Muted because on mute list.").catch(function(err){console.error('MUTE '+err);});
                                            }, function(err){console.error(err);});
                                        }
                                        dao.addMute(msg.guild.id,parsedMessage[3]);
                                    }else if (parsedMessage[2].toUpperCase() == 'REMOVE'){
                                        if(member !== null){
                                            tools.findByName(msg.guild.roles, 'Muted').then(function(role){
                                                member.roles.remove(role,"Not on mute list anymore.").catch(function(err){console.error('MUTE '+err);});

                                            }, function(err){console.error(err);});
                                        }
                                        dao.removePunishment(msg.guild.id,parsedMessage[3]);
                                    }
                                }else if (parsedMessage.length == 3){
                                    if (parsedMessage[2].toUpperCase() == 'LIST'){
                                        dao.getMutes(msg.guild.id).then(function(res){
                                            var string ="Muted members:\n";
                                            res.rows.forEach(function(punishedId){
                                                string = string + punishedId.id+" (<@"+punishedId.id+">)\n";
                                            });
                                            msg.reply(string).catch(function(err){console.error("Mute list: "+err);});
                                        });
                                    }
                                }
                                // On BAN 
                            }else if (parsedMessage[1].toUpperCase() == 'BAN'){
                                if(parsedMessage.length == 4){
                                    msg.guild.members.fetch(parsedMessage[3]).then(function(member){
                                        //We want to add a ban
                                        if(parsedMessage[2].toUpperCase() == 'ADD'){
                                            if(member !== null){
                                                member.ban().then(function(res){
                                                    dao.removePunishment(msg.guild.id,parsedMessage[3]); //They're banned, no need to keep them in the database
                                                },function(err){console.error('BAN '+err);});
                                            }else{
                                                dao.addBan(msg.guild.id,parsedMessage[3]);
                                            }
                                        }else if (parsedMessage[2].toUpperCase() == 'REMOVE'){
                                            dao.removePunishment(msg.guild.id,parsedMessage[3]);
                                            msg.guild.members.unban(parsedMessage[3]).then(function(res){
                                            },function(err){
                                                console.error("unBAN "+err);
                                            });
                                            dao.removePunishment(msg.guild.id,parsedMessage[3]);
                                        }
                                    }, function(err){console.error(err);});
                                }else if(parsedMessage.length == 3){
                                    if (parsedMessage[2].toUpperCase() == 'LIST'){
                                        dao.getBans(msg.guild.id).then(function(res){
                                            var string ="Banned members:\n";
                                            res.rows.forEach(function(punishedId){
                                                string = string + punishedId.id+" (<@"+punishedId.id+">)\n";
                                            });
                                            msg.reply(string).catch(function(err){console.error("Mute list: "+err);});
                                        });
                                    }
                                }
                            }else if (parsedMessage[1].toUpperCase() == 'UPDATESHARES'){
                                tools.updateShareMessage(msg.guild);
                            }else if (parsedMessage[1].toUpperCase() == 'REMOVEINACTIVES'){
                                tools.removeRoleFromInactive(msg.guild);
                            }else if(parsedMessage[1].toUpperCase()=='FREEZE'){
                                msg.reply("Freezing server, type .p unfreeze to unfreeze it. Don't forget to unmute trusted members").catch(function(err){
                                    console.error('FREEZE '+err);
                                });
                                dao.setFrozen(msg.guild, true);
                                msg.guild.members.fetch().then(function(members){
                                    members.forEach(function(currentMember){
                                        if(currentMember.joinedAt > new Date(Date.now()-86400000)){
                                            tools.findByName(msg.guild.roles, 'Muted').then(function(role){
                                                currentMember.roles.add(role,"Sorry for the inconvenience, we're facing difficulties and I hope you'll be patient enough.").then(function(res){
                                                    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, msg.guild, client, 'userFrozen', currentMember);
                                                },function(err){
                                                    tools.permissionEventNotifier(PermissionsBitField.Flags.ManageMessages, msg.guild, client, 'warn', 'Despite the raid, a mute role could not be given to user '+currentMember.user.tag);
                                                    console.error('Despite the raid, a mute role could not be given to user '+currentMember.user.tag+" "+err);
                                                });
                                            }, function(err){console.error(err);});
                                        }
                                    });
                                }, function(err){
                                    console.err(err);
                                });
                            }else if(parsedMessage[1].toUpperCase()=='UNFREEZE'){
                                dao.setFrozen(msg.guild, false);
                                msg.reply("Unfreezing server. Don't forget to unmute trusted members").catch(function(err){console.error('UNFREEZE '+err);});
                            }else if (parsedMessage[1].toUpperCase() == 'POLL' && parsedMessage.length == 4) {
                                //message.reply("Sorry this functionality is currently under maintenance").catch(function(err){console.error(err);});
                                var minutes =null;
                                minutes = parseInt(parsedMessage[3], 10);
                                if(Number.isNaN(minutes)||minutes<1){
                                    minutes = 1;
                                }
                                let s = '';
                                if(minutes>1){
                                    s ='s';
                                }
                                let embedDefinition = {
                                    embed: {
                                        title:parsedMessage[2],
                                        description:'Poll ending in '+minutes+' minute'+s+'!',
                                        color:tools.pollColor(1, 0),
                                        url:tools.website,
                                        thumbnail: {
                                            url: 'https://cdn.discordapp.com/attachments/467678655649415180/480066758292537350/bargraph.png'
                                        }	}	};
                                msg.channel.send(embedDefinition).then(function(myMessage){
                                    myMessage.react('👍').catch(function(err){ console.error(err); });
                                    myMessage.react('👎').catch(function(err){ console.error(err); });

                                    let snoozetime = parseInt(parsedMessage[3], 10)*60000;
                                    if(!Number.isNaN(snoozetime)){
                                        let targetDate = Date.now() + snoozetime;//generate the full date at which the event shall be consumed
                                        let pollEvent = tools.createTimedPollEvent(targetDate, myMessage.channel, myMessage, parsedMessage[2]);
                                        tools.submitTimedEvent(client, pollEvent);
                                    }
                                }, function(err){
                                    console.error("POLL "+err);
                                });
                            }
                        }
                        if(msg.member == msg.guild.owner||bestPower<=98){
                            if(parsedMessage[1].toUpperCase()==('BLACKLIST')){
                                dao.blacklistAdmin(msg.author, msg.guild).then(function(done){
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send('You will not receive generic notifications anymore.').catch(function(err){console.error(err);});
                                    }, function(err){
                                        console.error(err);
                                    });
                                }, function(message){
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send('Error: '+message).catch(function(err){console.error(err);});
                                    }, function(err){
                                        console.error(err+' \nMessage: '+message);
                                    });
                                });
                            }else if(parsedMessage[1].toUpperCase()==('WHITELIST')){
                                dao.whitelistAdmin(msg.author, msg.guild).then(function(done){
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send('You will receive generic notifications.').catch(function(err){console.error(err);});
                                    }, function(err){
                                        console.error(err);
                                    });
                                }, function(message){
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send('Error: '+message).catch(function(err){console.error(err);});
                                    }, function(err){
                                        console.error(err+' \nMessage: '+message);
                                    });
                                });
                            }else if(parsedMessage[1].toUpperCase()==('SUMMARY')){
                                tools.getGuildSummary(msg.guild).then(function(summary){
                                    msg.author.createDM().then(function(DMChannel){
                                        DMChannel.send(summary).catch(function(err){console.error(err);});
                                    }, function(err){console.error(err);});
                                });
                            }
                        }
                        if(parsedMessage[1].toUpperCase() === 'LEVEL'){
                            msg.author.createDM().then(function(DMChannel){
                                DMChannel.send('You are level '+bestPower);
                            }, function(err){
                                console.error(err);
                            });
                        }
                    });
                }
            }
        }
    }
});*/

client.login(Token);