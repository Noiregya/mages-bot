const Discord = require('discord.js');
const dao = require('./dao');

//TODO: Make new website
const website = "http://mages-bot.alwaysdata.net/";

//TODO: Rewrite help message
const help = ["List of available commands:"+
              "\`\`\`.p help - DM this message"+
              "\n.p help levels - Get explaination about the levels"+
              "\n.p level - Get your current level"+
              "\n.p blacklist - Stop receiving bot notifications"+
              "\n.p whitelist - Receive bot notifications again"+
              "\n.p snooze (text) (delay) - Reminds you of something in x minutes"+
              "\n.p summary - Sends you a summary of the current guild"+
              "\n.p ping - pings the bot\`\`\`",
              "Level 1 commands"+
              "\`\`\`.p assign (powerlevel) (@Role) - Gives bot rights to one Role"+
              "\n.p autoassign (ENABLE|DISABLE) Role - Enable/Disable autoassigning random nation when joining."+
              "\n.p setActiveRole (@Role) - Sets and enable the role to add to active users."+
              "\n.p clearActiveRole (@Role) - Disable and unset the role to add to active users."+
              "\n.p setActiveDelay (Delay) - Set the delay in days for inactivity.\`\`\`",
              "Level 2 commands"+
              "\`\`\`.p setInfoChannel (#Channel) - Sets the specified channel to the info channel."+
              "\n.p setWelcomeChannel (#Channel) - Sets the specified channel to be the welcome channel."+
              "\n.p setStarboardChannel (#Channel) - Sets the specified channel to be the starboard channel."+
              "\n.p (createNation|createSecretRoom) (Name) (Desciption) (Thumbnail) [Message_id] - Add the nation/secret room to the database."+
              "\n.p removeNation (Name) - Remove the nation/secret room from the database."+
              "\n.p reload - Update the information message"+
              "\n.p secure (#TagetChannel) [nolast] - Copy the pinned messages of the current channel into the target channel, add nolast to omit the oldest pinned message."+
              "\n.p clear [@Someone] [#Somewhere] -  Deletes all messages from everyone tagged in all the channels tagged among the 5000 last messages\`\`\`",
              "Level 3 commands"+
              "\`\`\`.p mute (add|remove|list) - Add someone to the mute list, people on the mute list are muted upon joining."+
              "\n.p ban (add|remove|list) - Ban or add someone to the ban list, people on the ban list are banned upon joining."+
              "\n.p freeze - Give the \"Muted\" role to everyone who has been in the server for less than a day, mute every new person."+
              "\n.p unfreeze - Stop muting every newcomer in the server, doesn't unmute muted ones."+
              "\n.p poll (Text) (Delay) - Create a poll on which users can answer with reactions - Text should be either 1 word or in quotes, Delay is the number of minutes before the end of the poll"+
              "\n.p updateShares - Manually update the share leaderboard."+
              "\n.p removeInactives - Remove active roles from inactive people."+
              "\n.p parrot (targetChannel) (message) - Repeats what you write in the target channel.\`\`\`"];

const helpAssign = "\`\`\`"+
      ".p assign (@Role) (Level) - Gives bot rights to one Role. It will allow the bot to listen to certain commands issued by certain roles. The bot will also send various notifications to people with the right level. The lower the level the stronger the role."+
      "\nA person with a certain level will inherit all higher roles. If someone has multiple registered roles, the most powerful will be used."+
      "\nRole - Role to assign a level to - You can either tag the role or type its name. Don't forget the quotes if there's a space in the role's name"+
      "\nLevel - The level to assign - A natural number between 0 and 99. If something different is entered, it will be replaced with 99."+
      "\n.p help levels - Informations about the levels"+
      "\n\`\`\`";

const helpLevels = "\`\`\`Levels are the amount of rights a registered user has. A lower level can do everything a higher level does."+
      "\nThe server Owner will always be considered as a level 1 even if they don't have any registered role."+
      "\nLevel 0  - Bot owner - Can do everything and will be notified about technical things"+
      "\nLevel 1  - Server Owner - Can do powerful commands and receive information on most stuff happening in the server"+
      "\nLevel 2  - Administrator - Can do some server management commands and receive information on management"+
      "\nLevel 3  - Moderator - Can do moderation commands and receive basic server logs"+
      "\nLevel 98 - Informated user - Can receive basic server info"+
      "\nLevel 99 - Mr Nobody - Useless, could not be registered for what I care.\`\`\`";

const helpCreateNation = "Help for CreateNation:\n"+
      "\`\`\`Allows adding a nation to the database, so the nation role can be joined by reacting to the welcome message\n"+
      ".p createNation (Name) (Desciption) (Thumbnail) [Message_id]\n"+
      'Choose between "createNation" and "createSecretRoom". The first will create a unique auto assign role, meaning you can only have one at a time. The other has no restrictions.\n'+
      "Name: Name of the nation, needs a role that has the same name to exists\n"+
      'Desciption: Desciption of the nation, use double quotes around it (") if there are spaces\n'+
      "Thumbnail: url of the thumbnail for the nation\n"+
      "Message_id: id of the message that you can use to join a nation, .p reload sets it so it's optionnal\n"+
      "To create an alternative event nation:\n"+
      ".p createEventNation (Name) (Desciption) (Thumbnail) (Channel) (Message_id)\n"+
      "\`\`\`";

const things = [
    "You can be our new lab member!",
    'You would make a perfect assistant.',
    'Are you from the organisation?!',
    "The thing you're holding... Is this the Doc. P?",
    "Are you the new test subject?",
    "Do you want to try out my new [Magic] robot?",
    "Did you bring... you know what?",
    "Do you know 5pb? We're actually related.",
    "Operation Revelation will now commence.",
    "That's \"MAGES.\" with a period.",
    "No one knows what Doc P is?! The drink of the chosen, Doc Tear Popper?!",
    "I bid you luck. Loochs tneve emag noitamina cisum.",
    "Believe what you believe, but note that what you believe is not reality.",
    "It has been awhile, assistant.",
    "I have a regal mission to search for Doc P. Now, if you'll excuse me...",
    'You invert well between serious and comical. I dub you the "Theme Breaker."',
    "This is as the Stone Door of Faith has selected. Loochs tneve emag noitamina cisum.",
    "Is this fate's doings?",
    "Are you from this dimension? I don't feel any magic coming from you."
];

const owos= [
    'This dimension appears to not have many intelligent beings...',
    'I don\'t know why, but those symbols make me wince.',
    'Ah, it happened again, the culture here has many strange aspects.',
    'Even Neptune has a brain big enough not to do that.',
    'I don\'t like where this is going.',
    'Maybe you should reconsider your life choices...',
    'As a friendly reminder, this is a no owo and uwu zone!',
    'Your behavior has been reported to the competent authorities.',
    'I never wanted to jump to another dimension as much before.',
    'Sometimes, it can be a good idea to take a break from the internet.',
    'If you keep doing this I will stop answering to you.',
    'Are you in need of a friend?',
    'You really should stop doing that, for your own good.'
];

const reiReact= [
    'Rei rei!',
    'Are you here to torment me again?',
    'Oh hello Rei.',
    '<:ReiTard:485418514207866920>',
    'Nothing better to do Rei?',
    'Hello',
    'Huh?',
    'Are you referring to me?',
    '🤔',
    'Blah blah blah, period I know.',
    'Go away',
    'I\'m not in the mood to deal with you today.',
    'What do you want?',
    'I\'m just a bot, what do you want from me',
    'How many times have you done this already?',
    'Are you feeling lonely? Do you need a friend?',
    'Could you bother someone else today?',
    'How many times do I have to tell you it is MAGES. not mages?',
    'My favourite P word is Doc. P, not period. But you\'re really pushing it Rei'
];

const helloDislike= [
    'Could you stop talking to me?',
    'Hello I guess.',
    'You... not a good way to start a day...',
    'Heh',
    'Goodbye.'
];
const helloNeutral= [
    'Hi',
    'Hello',
    'Hey',
    'Greetings',
    'Hello, have a nice day'
];
const helloLike = [
    'Hi!',
    'Hello!',
    'Good to see you!',
    'I\'m glad to see you today.',
    'Hello, how are you?',
    'I hope you\'re having a nice day!',
    'Good day!',
    'Goodmorrow!',
    'How fares?',
    'Bless thee, have a good day'
];
const helloLove = [
    'Hello dear!',
    'Bless thee, have a good day',
    'I\'m so glad to have you with us.',
    'Do you want to try my new invention?',
    'Well be with you assistant.',
    'Hello! I\'m sure you\'ll come in handy, care to help me later?',
    'Hi, may Doc P be with you.',
    'Hello, just curious, when is your birthday?',
    'Hi, welcome to my lab. May I call you Assistant?',
    'Hello! thinking about it, it\'s a bit like you\'re part of the family now.'
];

const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

async function asyncForEach(array, callback) { // jshint ignore:line
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array) // jshint ignore:line
    }
}

// A function that can be called to private message the bot's target to make sure they know
function genericEventNotifier(target, name, currentEvent, parameter2){
    target.createDM().then(function(dmChan){
        let string;
        switch(name){
            case 'guildCreate':
                string = "I decided to join a new laboratory, it's called "+currentEvent.name+".\n";
                break;
            case 'error':
                string = 'Websocket error '+currentEvent.name+'\n'+currentEvent.message+'\n'+
                    "I've failed I've failed I've failed \n"+
                    "I've failed I've failed I've failed \n"+
                    "I've failed I've failed I've failed \n";
                break;
            case 'guildDelete':
                string = "I'm no longer in "+currentEvent.name+'... I wonder what happened.';
                break;
            case 'warn':
                string = 'General warning: '+currentEvent;
                break;
            case 'guildBanAdd':
                string = currentEvent.tag+' has been banned from the '+parameter2.name+' realm';
                break;
            case 'guildBanRemove':
                string = currentEvent.tag+' has been unbanned from the '+parameter2.name+' realm';
                break;
            case 'guildMemberAdd':
                string = "Hey, today <@"+currentEvent.id+"> ("+currentEvent.user.tag+") joined "+currentEvent.guild.name;
                break;
            case 'guildMemberRemove':
                string = "Sad news, <@"+currentEvent.id+"> ("+currentEvent.user.tag+") left "+currentEvent.guild.name;
                break;
            case 'userFrozen':
                string = "Member "+currentEvent.user.tag+" was frozen from "+currentEvent.guild.name+" because of the server's policy.";
                break;
            case 'guildMuteAdd':
                string = "Member "+currentEvent.user.tag+" was muted from "+currentEvent.guild.name+". Check audit logs for more info.";
                break;
            default:
                string = 'No message for event '+name+'\n';
                string += JSON.stringify(currentEvent);
        }
        dmChan.send(string).catch(function(err){
            console.error('Unable to send DM, '+err);
        });
    },function(err){
        console.error('Cannot create DM: '+err+'\n');
    });
}

async function findByName(manager, name){ // jshint ignore:line
    let res;
    await manager.fetch().then(function (element){ // jshint ignore:line
        res = manager.cache.find(element => element.name === name);
    });
    return res;
}

//Notify users with a specific permission
async function permissionEventNotifier(permissionFlag, guild, name, currentEvent, parameter2){
    let res = 'Notification sent to:';
    let admins = await dao.getWhiteListedAdmins(guild.id).catch(function(err){
        console.error('Error getting whitelisted admins: '+err);
    });
    let ids = [];
    for(admin of admins.rows){
        ids.push(admin.id);
    }
    let members = await guild.members.fetch({user: ids});
    members.forEach(function(member){
        if(member.permissions.has(permissionFlag)){
            res += '\n' + member.user.tag;
            genericEventNotifier(member.user, name, currentEvent, parameter2);
        }else{
            console.error(member.user.tag + ' could not be notified\n');
        }
    });
    return res;
}

/**
 * Notify all members with a specific permission flag
 * @param {*} guild 
 * @param {*} error 
 */
async function permissionErrorNotifier(guild, permissionFlag, error){
    let res = 'Notification sent to:';
    let users = [];
    if(guild){
        let admins = await dao.getWhiteListedAdmins(guild.id).catch(function(err){
            console.error('Error getting whitelisted admins: '+err);
        });
        let ids = [];
        admins.rows.forEach(function(row){
            ids.push(row.id);
        })
        let members = await guild.members.fetch({user: ids});
        members.forEach(function(member){
            if(member.permissions.has(permissionFlag)){
                res += '\n' + member.user.tag;
                users.push(member.user);
                //genericEventNotifier(member.user, name, currentEvent, parameter2);
            }else{
                console.error(member.user.tag + ' could not be notified\n');
            }
        });
    }
    console.log(users);
    for(user of users){
        let dm = await user.createDM().catch(err=>console.error('Cannot send DM '+err));
        dm.send(errorLog(error));
    }
    return res;
}

//Unused for now but might be handy?
async function getUserPower(member, guild){ // jshint ignore:line
    if(member == guild.owner){
        return 1;
    }
    return await dao.getLocalPowerLevels(guild).then(function(powerLevels){ // jshint ignore:line
        var bestPower = 99;
        if(powerLevels!== null){
            powerLevels.rows.forEach(function(role){
                if(member.roles.cache.get(role.role)!== null && role.powerlevel<bestPower){
                    bestPower = role.powerlevel;
                }
            });
        }
        return bestPower;
    }, function(err){console.error('getUserPower '+err);});
}

async function getUsersPower(members, guild){ // jshint ignore:line
    let membersWithLevel = [];
    let powerLevels;
    await dao.getLocalPowerLevels(guild).then(function(pl){ // jshint ignore:line
        powerLevels = pl;
    }, function(err){console.error('getUsersPower '+err);});
    for(let i = 0; i < members.length; i++){
        let member;
        let memberLine = members[i];
        await guild.members.fetch(memberLine.user_id).then(function(mm){ // jshint ignore:line
            member = mm;
        }, function(err){ // jshint ignore:line
            console.error('Unable to fetch member '+memberLine.user_id+'\n'+err);
        });
        if(member){
            if(member.id === guild.owner.id){
                membersWithLevel.push({
                    member: member,
                    power: 1
                });
            }else{
                var bestPower = 99;
                if(powerLevels!== null){
                    powerLevels.rows.forEach(function(role){ // jshint ignore:line
                        if(member.roles.cache.get(role.role)!== null && role.powerlevel<bestPower){
                            bestPower = role.powerlevel;
                        }
                    });
                }
                membersWithLevel.push({
                    member: member,
                    power: bestPower
                });
            }
        }
    }
    return membersWithLevel;
}

function randomWelcome(){
    return things[Math.floor(Math.random()*things.length)];
}

function randomOWOreact(){
    return owos[Math.floor(Math.random()*owos.length)];
}

function randomHelloReact(friendliness){
    var selectedCollection;
    if(friendliness <= 0){
        //Doesn't even answer
        return '';
    }else if(friendliness <= 7){
        selectedCollection = helloDislike;
    }else if(friendliness <= 13){
        selectedCollection = helloNeutral;
    }else if(friendliness <= 30){
        selectedCollection = helloLike;
    }else if (friendliness > 30){
        selectedCollection = helloLove;
    }
    return selectedCollection[Math.floor(Math.random()*selectedCollection.length)];
}

function randomReiReact(){
    return reiReact[Math.floor(Math.random()*reiReact.length)];
}

function getRandomNation(guild){
    return dao.getNations(guild.id).then(function(nations){
        let realNations = [];
        nations.rows.forEach(function(nation){
            if(nation.isunique){
                realNations.push(nation);
            }
        });
        return realNations[Math.floor(Math.random()*realNations.length)];
    },function(err){
        console.error('getRandomNation() '+err);
    });
}

function joinNation(role, member, nations){
    var goodNation;
    nations.forEach(function(nation){
        if(nation.name == role.name){
            goodNation = nation;
        }
    });
    member.roles.add(goodNation.role_id).catch(function(err){
        console.error("Coudn't add role "+err);
    });
    if(goodNation.isunique){
        nations.forEach(function(nation){
            if(nation.isunique && nation.name != goodNation.name){ 
                member.roles.remove(nation.role_id).catch(function(err){
                    console.error("Couldn't remove role"+err);
                });
            }
        });
    }
}

function resolveChannelString(guild, string){
    let targetChannel;
    if(string.startsWith('<#')){
        targetChannel = guild.channels.resolve(string.substring(2, 20));
    }else{
        targetChannel = guild.channels.resolve(string);
    }
    if(targetChannel){
        return targetChannel;
    }else{
        throw new Error("Channel "+string+" doesn't exist in guild "+guild.name+". Please provide a channel ID or tag the channel.");
    }
}

async function convertMessageToEmbed(msg, prefix){ // jshint ignore:line
    var member = null;
    var message = msg;
    await message.channel.messages.fetch(message.id).then(function(newMessage){ // jshint ignore:line
        message=newMessage;
    }, function(err){
        console.error("convertMessageToEmbed() "+err);
    });
    await message.guild.members.fetch(message.author, true).then(function(fetchedMember){ // jshint ignore:line
        member = fetchedMember;
    },function(err){
        console.error(" author: "+ message.author +" convertMessageToEmbed()"+err);
    });
    var richArray = [];
    var color = 0;
    if (member !== null){
        /*color = 'GREY';
        await getMemberNation(member).then(function(nation){ // jshint ignore:line
            if(nation !== null){
                color = nation.color;
            }
        }, function(err){
            console.error("convertMessageToEmbed() "+err);
        });*/
        color = member.displayColor;
    }else{
        console.log("Member "+message.author.tag+" seems to have left.");
    }

    let content = stripLinks(message.content);
    let description = content.text;
    let authorName = prefix+message.author.tag
    let authorIcon = message.author.displayAvatarURL();
    let timestamp = new Date(message.createdTimestamp);

    let attachements = message.attachments.array();
    let embeds = message.embeds;
    if(embeds.length !== 0){
        embeds.forEach(function(embed){
            embed.setThumbnail('');
            let toPublish = decorate(embed, description, authorName, authorIcon, timestamp, color);
            if(embed.type === 'image'){
                embed.setImage(embed.url);
                richArray.push(toPublish);
            }
            else{
                toPublish.description += '\n *___See content below.___*';
                richArray.push(toPublish);
                richArray.push(embed.url);
            }
        });
    }
    if(attachements.length !== 0){
        attachements.forEach(function(value){
            let tempRich = new Discord.MessageEmbed();
            tempRich.setImage(value.url);
            tempRich.type = 'image';
            richArray.push(decorate(tempRich, description, authorName, authorIcon, timestamp, color));
        });
    }
    if(richArray.length === 0){
        richArray.push(decorate(new Discord.MessageEmbed(), description, authorName, authorIcon, timestamp, color));
    }
    return richArray;
}

function stripLinks(string){
    let strippedMessage = new Object();
    strippedMessage.links = string.match(urlRegex);
    strippedMessage.text = string.replace(urlRegex, '');
    return strippedMessage;
}

function decorate(embed, description, authorName, authorIcon, timestamp, color){
    embed.setDescription(description)
        .setAuthor(authorName, authorIcon)
        .setTimestamp(timestamp)
        .setColor(color);
    return embed;
}

async function getMemberNation(member){ // jshint ignore:line
    if (member !== null){
        //get nation
        return await dao.getNations(member.guild.id).then(async function(nations){ // jshint ignore:line
            var result;
            await nations.rows.forEach(function(nation){ // jshint ignore:line
                let correspondingNation = member.roles.cache.filter(role => role.id == nation.role && nation.isunique);
                if(correspondingNation.array().length !== 0){
                    result = correspondingNation.array()[0];
                }
            });
            return result;
        }, function(err){ // jshint ignore:line
            console.error("nations "+err);
        }); // jshint ignore:line
    }
}

function updateInfoMessage(channel, member, dao){
    deleteOneInAChannel(channel, member);
    let guild = channel.guild;
    channel.send('\`\`\`React to the below messages to join a nation and secret rooms!\`\`\`').catch(function(err){console.error('updateInfoMessage() '+err);});
    dao.getNations(guild.id).then(function(nations){
        nations.rows.forEach(function(currentNation){
            let embedNation = {
                embed: {
                    title:currentNation.name,
                    description:currentNation.description,
                    color:currentNation.color,
                    url:website,
                    thumbnail: {
                        url: currentNation.thumbnail
                    }	}	};
            channel.send(embedNation).then(function(message){
                message.react('👍').then(function(res){
                }, function(err){
                    console.error("Could not react "+err);
                });
                let role = guild.roles.resolve(currentNation.role);
                dao.updateMessageId(role, message.id);
            }, function(err){
                console.error("Couldn't send message "+err);
            });
        });
        //Shares

        makeShareMessage(guild).then(function(shareMessage){
            channel.send(shareMessage).then(function(message){
                dao.updateShareMessage(guild, message.id);
            },function(err){console.error('makeShareMessage() '+err);});
        });

        //Invite link
        channel.guild.fetchInvites().then(function(invites){
            var finalInvite=null;
            invites.array().forEach(function(invite){
                if(!invite.temporary && invite.maxUses=== 0){
                    finalInvite = invite;
                }
            });
            if(finalInvite!== null){
                channel.send('Feel free to invite your friends using this link!\n'+finalInvite.url).catch(function(err){console.error('updateInfoMessage() '+err);});
            }
        }, function(err){console.error('fetchInvites() '+err);});
    },function(err){
        console.error("Could not get nations "+err);
    });
}
function updateShareMessage(guild){
    makeShareMessage(guild).then(function(shareMessage){
        dao.getInfoChannel(guild).then(function(infoChannelId){
            let channel = guild.channels.resolve(infoChannelId);
            if(channel !== null){
                dao.getShareMessage(guild).then(function(toEdit){
                    channel.messages.fetch(toEdit).then(function(messageObject){
                        messageObject.edit(shareMessage).catch(function(err){console.error('updateInfoMessage() '+err);});
                    }, function(err){console.error('updateShareMessage() message: '+shareMessage.fieldsArray+' guild: '+guild.name+" : "+err);});
                }, function(err){
                    console.error('updateShareMessage() guild: '+guild.name+" : "+err);
                });
            }else{
                console.error('updateShareMessage() guild: '+guild.name+" : Impossible to resolve channel.");
            }

        }, function(err){
            console.error('updateShareMessage() guild: '+guild.name+" : "+err);
        });
    },function (err){
        console.error('updateShareMessage() guild: '+guild.name+" : "+err);
    });
}

function makeShareMessage(guild){
    let fieldsArray = [];
    return getShares(guild).then(function(shares){
        if(shares !== undefined){
            if(shares.length>0){
                let total=0;
                shares.forEach(function(nationShare){
                    total+=nationShare.count;
                });
                shares.forEach(function(nationShare){
                    fieldsArray.push({//TODO: HERE
                        name: nationShare.nation.name,
                        value: "Shares: "+Math.round((nationShare.count*100)/total)+"%"
                    });
                });
                return {embed: {
                    color: 0x7F20AF,
                    author: {
                        name: "Share war",
                        icon_url: guild.iconURL
                    },
                    title: "This dimension's shares",
                    description: "See the current nations shares below.",
                    fields: fieldsArray,
                    timestamp: new Date()}};
            }
        }
        return "";
    }, function(err){console.error('makeShareMessage '+err);});
}


async function deleteOneInAChannel(channel, member){// jshint ignore:line
    var lastMessage = channel.lastMessageID;
    var messageArray = [];

    if(lastMessage === null){
        return;
    }
    var runs = 0;
    let isDone = false;
    while(!isDone || runs < 100){//100 runs * 50 messages = 5000 messages
        runs++;
        isDone = await channel.messages.fetch({before:lastMessage.id}).then(function(messages){// jshint ignore:line
            let messageArray = messages.array();
            if(messageArray.length === 0){
                return true;
            }else{			//No more messages.
                messageArray.forEach(function(message){
                    if(message.author.id.includes(member.id)){
                        message.delete().catch(function(err){console.error("Couldn't delete message '"+message.content+"' in guild "+channel.guild.name);});
                    }
                    lastMessage = message;
                });
            }
            return false;
        }, function(err){// jshint ignore:line
            console.error(err);
        });
        if(isDone){
            break;
        }
    }
    let i = messageArray.length;
    let head = messageArray;
    let tail = messageArray;
    while(i>0){
        if(head.length>1){
            head = tail.slice(0,100);
            tail = tail.slice(100);
        }
        await channel.bulkDelete(head, true).then(function(result){// jshint ignore:line
        },function(message){// jshint ignore:line
            console.log(message);
        }, function(err){// jshint ignore:line
            console.error(err);
        });
        i = i-100;
    }

}

function deleteAllInAChannel(channel, members){
    if (channel.type === 'text'){
        members.forEach(function(member){
            deleteOneInAChannel(channel, member);
        });
    }
}

function sleep(ms){ //TOOL
    return new Promise(resolve=>{
        setTimeout(resolve,ms);
    });
}

function leaveNation(role, member, nations){
    nations.forEach(function(nation){
        if(nation.name == role.name){
            member.roles.remove(nation.role_id).then(function(fulfilled){
            }, function(err){
                console.error("Coudn't remove role "+err);
            });
        }
    });
}

function getShares(guild){
    return guild.members.fetch().then(function(memberCollection){
        return dao.getNations(guild.id).then(function(nationsRequest){
            let countArray = [];
            nationsRequest.rows.forEach(function(nationRequest){
                if(nationRequest.isunique){
                    let memberCount = 0;
                    memberCollection.array().forEach(function(member){
                        member.roles.cache.forEach(function(role){
                            if(role.id == nationRequest.role){
                                memberCount++;
                            }
                        });
                    });
                    countArray.push({nation:nationRequest, count:memberCount});
                }
            });
            return countArray;
        }, function(err){console.error("getShares() "+err);});
    }, function(err){console.error('getShares() '+err);});
}

function calculateYesterday(date){
    var newDate = new Date(date);
    newDate.setDate(date.getDate()-1);
    return newDate;
}

function pollColor(yes, no){
    let total = yes+no;
    let red = (255/total)*no;
    let green = (255/total)*yes;
    return (red<<16)+(green<<8);
}

function getResultImage(yes, no){
    let percentY = 100/(yes+no)*yes;
    if(percentY>90){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072132290805781/result100-0.png';
    }else if(percentY>=80){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072092776136704/result90-10.png';
    }else if(percentY>=70){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072090083393549/result80-20.png';
    }else if(percentY>=60){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072087793565697/result70-30.png';
    }else if(percentY>=55){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072085562196008/result60-40.png';
    }else if(percentY<55 && percentY>45){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072082755944448/result50-50.png';
    }else if(percentY>=40){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072080608460820/result40-60.png';
    }else if(percentY>=30){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072077248823307/result30-70.png';
    }else if(percentY>=20){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072072471773204/result20-80.png';
    }else if(percentY>=10){
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072069837619200/result10-90.png';
    }else{
        return 'https://cdn.discordapp.com/attachments/475667090574016543/480072062048927744/result0-100.png';
    }
}

function parseMessage(string){
    if(string){
        var spaces = string.trim().split('"');
        var peer = true;
        var parsedCommand = [];
        spaces.forEach(function(space){
            if(peer){
                parsedCommand = parsedCommand.concat(space.trim().split(" "));
            }else{
                parsedCommand.push(space);
            }
            peer = !peer;
        });
        return parsedCommand.filter(value => Object.keys(value).length !== 0);
    }
    return '';
}

function getInactiveMembers(guild, delay){
    return guild.members.fetch().then(function(memberCollection){
        let list = [];
        //Get all members that are ACTIVE
        return getActiveMembers(guild, delay).then(function(activeUsers){
            memberCollection.array().forEach(function(member){
                if(!activeUsers.includes(member.id)){
                    list.push(member);//Add them in the list if they're not included in the active list
                }
            });
            return list;
        }, function(err){
            console.error('listInactives() '+err);
            throw err;
        });
    }, function (err){// jshint ignore:line
        console.error("listInactives() "+err);
        throw err;
    });
}

async function getActiveMembers(guild, delay){// jshint ignore:line
    let limit = new Date();
    limit.setTime(new Date().getTime()-(delay*86400000));//Substract the number of days
    let list = [];
    channelArray = await guild.channels.cache.array();// jshint ignore:line
    await asyncForEach(channelArray,async function(channel){// jshint ignore:line
        //For each channel
        if(channel.type == "text"){// jshint ignore:line
            let lastMessage = await channel.messages.fetch(channel.lastMessageID);// jshint ignore:line
            // Get the first message in the channel
            if(lastMessage!== null){ //The channel can be empty
                if(!list.includes(lastMessage.author.id))
                {//Process the first message alone
                    list.push(lastMessage.author.id);
                }
                var hasMoved=0;//Prevents from staying in a loop if there's no more messages in the server
                while(lastMessage.createdAt>limit && hasMoved!=lastMessage){
                    hasMoved=lastMessage;
                    await channel.messages.fetch({before:lastMessage.id}).then(async function(fetchedMessages){// jshint ignore:line
                        await asyncForEach(fetchedMessages.array(),function(currentMessage){// jshint ignore:line
                            lastMessage = currentMessage;
                            if(currentMessage.createdAt>limit){
                                if(!list.includes(currentMessage.author.id)){//Check if the member doesn't already exist.
                                    list.push(currentMessage.author.id);
                                }
                            }
                        });
                    }, function(err){// jshint ignore:line
                        console.error("getActiveUserList() "+err);
                        throw err;
                    });
                }
            }else{
                console.error("getActiveUserList() No message found for channel "+channel.name); 
            }
        }
    });// jshint ignore:line
    return list;//List of member IDs because faster and easier to compute in this case.
}

function createTimedMessageEvent(targetDate, channel, content){
    let event = {};
    event.metadata = {};
    event.metadata.text = content;
    event.type = 'message';
    event.deadline = targetDate;
    if(channel.type === 'text'){
        event.location = 'text.'+channel.guild.id+'.'+channel.id;
    }else if(channel.type === 'dm'){
        event.location ='dm.'+channel.recipient.id;
    }
    return event;
}

function createTimedPollEvent(targetDate, channel, message, title){
    let event = {};
    event.metadata = {};
    event.metadata.message = message.id;
    event.metadata.title = title;
    event.type = 'poll';
    event.deadline = targetDate;
    if(channel.type === 'text'){
        event.location = 'text.'+channel.guild.id+'.'+channel.id;
    }else if(channel.type === 'dm'){
        event.location ='dm.'+channel.recipient.id;
    }
    return event;
}


function loadTimedEvents(client){
    return dao.getTimedEvents().then(function(res){
        res.rows.forEach(function(line){
            let event = {};
            event.id = line.id;
            try{
                event.metadata = JSON.parse(line.metadata);
                event.deadline = line.deadline;
                event.type = line.type;
                event.location = line.location;
                executeTimedEvent(client, event);
            }catch(e){
                console.error('loadTimedEvents '+e+'\nRemoving event '+event.id);
                dao.removeTimedEvent(event);
            }
        });
    },function(err){
        console.error('loadTimedEvents '+err);
    });
}

// Setup an event and add it to the database
async function submitTimedEvent(client, event){// jshint ignore:line
    let eventId = await dao.addTimedEvent(event); // jshint ignore:line
    event.id = eventId;
    return executeTimedEvent(client, event);
}

function executeTimedEvent(client, event){
    let baseDate = Date.now();
    let timeLeft = event.deadline - baseDate;
    if(timeLeft < 0){//If the deadline is already passed
        timeLeft = 0;
    }
    setTimeout(function(){
        consumeTimedEvent(client, event);
    }, timeLeft);
    return event;
}

/*Consume an event and remove it from the database*/
async function consumeTimedEvent(client, event){// jshint ignore:line
    let location = event.location.split('.');
    let channel;
    //Get channel
    if(location[0] === 'text'){
        let guild = client.guilds.resolve(location[1]);
        if(guild){
            channel = guild.channels.resolve(location[2]);
        }
    }else if(location[0] === 'dm'){
        channel = await client.users.fetch(location[1]).then(async function(user){// jshint ignore:line
            return await user.createDM().catch(function(err){// jshint ignore:line
                console.error('consumeTimedEvent when creating DM '+err);
            });
        }, function(err){// jshint ignore:line
            console.error('consumeTimedEvent when fetching user '+err);
        });// jshint ignore:line
    }
    if(!channel){
        dao.removeTimedEvent(event);//Cannot send message, delete event
        return;
    }
    switch (event.type){
        case 'message':
            channel.send(event.metadata.text).then(function(res){
                dao.removeTimedEvent(event); //Message has been sent, event gets consumed
            }, function(err){console.error('consumeTimedEvent when sending message '+err);});
            break;
        case 'poll':
            let message = await channel.messages.fetch(event.metadata.message).catch(function(err){// jshint ignore:line
                console.error(err);
                dao.removeTimedEvent(event);//Message doesn't exist, delete event
            });
            if(message){
                let yes = message.reactions.resolve('👍');
                let no = message.reactions.resolve('👎');
                if(yes !== null && no !== null){
                    yes = yes.count-1;
                    no = no.count-1;
                    let embedResult = {
                        embed: {
                            title:event.metadata.title,
                            description:'Results :\nYes: '+yes+' No: '+no,
                            color:pollColor(yes, no),
                            url:website,
                            thumbnail: {
                                url: getResultImage(yes,no)
                            }	
                        }	
                    };
                    message.channel.send(embedResult).then(function(res){
                        dao.removeTimedEvent(event); //Message has been sent, event gets consumed
                    },function(err){
                        console.error('Unable to post message '+err); //Keep event if message fails?
                    });
                }else{
                    console.error('The message has been lost.');
                    dao.removeTimedEvent(event); //Message can't be read, remove event
                }
            }
            break;
        default:
            console.error('Event type '+event.type+ ' unknown. Event:'+event);
            dao.removeTimedEvent(event); //Event unknown, remove event
    }
}


function removeRoleFromInactive(guild){
    console.log('Removing inactives from '+guild.name);
    getInactiveMembers(guild,30).then(function(inactives){
        dao.getActiveRoles(guild, false).then(function(roleRes){

            inactives.forEach(function(inactive){
                console.log(roleRes);
                inactive.roles.remove(roleRes).then(
                    function(res){
                        console.log('Removed roles from '+res.displayName);
                    },function(err){
                        console.error('removeRoleFromInactive '+err);
                    });
            });
        }, function(err){
            console.error('removeRoleFromInactive '+err);
        });
    },function(err){
        console.error('Ready '+err);
    });
}

function sendNext(pinnedArray ,i ,notLast ,targetChannel){
    if(i >= 0 && i < pinnedArray.length-1 || i == pinnedArray.length-1 && !notLast){
        tools.convertMessageToEmbed(pinnedArray[i], '📌 ').then(function(toSend){
            toSend.forEach(function(embed){
                targetChannel.send(embed).then(function(res){
                    if(pinnedArray[i].pinned){
                        pinnedArray[i].unpin().catch(function(err){
                            console.error("unpin() "+err);
                        });
                    }
                    sendNext(pinnedArray, i-1, notLast, targetChannel);
                }, function(err){
                    console.error("SECURE "+err);
                });
            });
        });
    }else if(i == pinnedArray.length-1){
        sendNext(pinnedArray, i-1, notLast, targetChannel);
    }
}

//Unified method of adding business information to an error object before throwing it
function errorContext(err, message, secret) {
    if (!err.business) err.business = []; //Create array if it doesn't exist
    if (!message) message = 'Failed to provide message element to the errorContext function';//Error if called improperly
    let rank = err.business.push(message) - 1; //Adds the message to the array and returns the index of that element
    //Information useful for debugging but that we don't want to show the end user
    if (secret) {
      if (!err.secret) err.secret = [];
      err.secret[rank] = secret; //Secret placed at the same index as the business message
    }
    return err;
}

//Display the logs formatted properly in the logs
function errorLog(errs) {
    let string;
    if (!Array.isArray(errs))
      errs = [errs];
    errs.forEach(err => {
      string = 'An error occured: ' + err.name + ' : ' + err.message + '\n';
      if (err.business) {
        for (i = 0; i < err.business.length; i++) {
          string += err.name + ' : ' + err.business[i];
          if (err.secret && err.secret[i]) string += ' ' + err.secret[i];
          string += '\n'
        }
      }
      console.error(string);
    });
    return string;
  }

module.exports = {
    asyncForEach: asyncForEach,
    calculateYesterday: calculateYesterday,
    consumeTimedEvent: consumeTimedEvent,
    convertMessageToEmbed: convertMessageToEmbed,
    createTimedMessageEvent: createTimedMessageEvent,
    createTimedPollEvent: createTimedPollEvent,
    deleteAllInAChannel: deleteAllInAChannel,
    deleteOneInAChannel: deleteOneInAChannel,
    executeTimedEvent: executeTimedEvent,
    findByName: findByName,
    genericEventNotifier: genericEventNotifier,
    getActiveMembers: getActiveMembers,
    getInactiveMembers: getInactiveMembers,
    getMemberNation: getMemberNation,
    getRandomNation: getRandomNation,
    getResultImage: getResultImage,
    getShares: getShares,
    help: help,
    helpAssign: helpAssign,
    helpCreateNation: helpCreateNation,
    helpLevels: helpLevels,
    joinNation: joinNation,
    leaveNation: leaveNation,
    loadTimedEvents: loadTimedEvents,
    parseMessage: parseMessage,
    permissionEventNotifier: permissionEventNotifier,
    pollColor: pollColor,
    randomHelloReact: randomHelloReact,
    randomOWOreact: randomOWOreact,
    randomReiReact: randomReiReact,
    randomWelcome: randomWelcome,
    removeRoleFromInactive: removeRoleFromInactive,
    sendNext: sendNext,
    sleep: sleep,
    stripLinks: stripLinks,
    submitTimedEvent: submitTimedEvent,
    updateInfoMessage: updateInfoMessage,
    updateShareMessage: updateShareMessage,
    website: website,
    resolveChannelString:resolveChannelString,
    permissionErrorNotifier: permissionErrorNotifier,
    errorContext: errorContext,
    errorLog: errorLog
};
