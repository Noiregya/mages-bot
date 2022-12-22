const tools = require('./tools');
const dao = require('./dao');
const { PermissionsBitField } = require('discord.js');


//Notify a new member in the dedicated welcome channel (if any)
async function notifyNewMember(member){
    checkNewMember(member).then(function(res){
        if(res === 'ok'){
            raidProtection(member).then(function(res){
                welcomeNewMember(member);
            });
        }
    });
}

//Check if new member is ok
async function checkNewMember(member){
    let res = 'ok';
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
            tools.levelEventNotifier(3, member.guild, 'warn', 'Could detect potential raid but not ban user'+
                                     '\n User: '+member.user.tag+'\nReason: '+err);});
        tools.levelEventNotifier(3, member.guild, 'guildBanAdd', member.user, member.guild);
        res = 'banned';
    } else if(punishment == 'muted'){
        let role = await tools.findByName(member.guild.roles, 'Muted').catch(function(err){
            console.error(err);
            tools.levelEventNotifier(3, member.guild, 'warn', 'User is marked as muted but I couldn\'t mute them automatically'+
                                     '\n User: '+member.user.tag+'\nReason: '+err);
        });Ò
        member.roles.add(role,'Muted because on mute list.').catch(function(err){console.error('MUTE'+err);});
        res = 'muted';
    } else {
        //If the member isn't banned, check for other things
        let limitDate = member.user.createdAt;
        console.log(limitDate);
        limitDate.setDate(limitDate.getDate() +1);
        console.log(limitDate);
        if(new Date() < limitDate){
            console.log('New account');
            let role = await tools.findByName(member.guild.roles, 'Muted').then(function(err){console.error(err);});
            member.roles.add(role,"Account is too young").catch(function(err){console.error('MUTE '+err);});
            res = 'muted';
            tools.levelEventNotifier(3, member.guild, 'guildMuteAdd', member);
        }
        tools.levelEventNotifier(3, member.guild, 'guildMemberAdd', member);
    }
    return res;
}

function raidProtection(member){
    dao.isFrozen(member.guild).then(function(res){
        let isFrozen = res.rows[0].is_frozen;
        if (isFrozen){
            tools.findByName(member.guild.roles, 'Muted').then(function(role){
                member.roles.add(role).then(function(res){
                    member.user.createDM().then(function(DM){
                        DM.send('Sorry for the inconvenience, the guild is facing difficulties and you\'ve been muted, a moderator should contact you shortly.').catch(function(err){
                            console.error('Cannot send DM to '+member.user.tag+ ' '+err);
                        });
                    }, function(err){
                        console.error(err);
                    });
                    tools.levelEventNotifier(3, member.guild, client, 'userFrozen', member);
                },function(err){
                    tools.levelEventNotifier(3, member.guild, client, 'warn', 'Despite the raid, a mute role could not be given to user '+member.user.tag);
                    console.error('Despite the raid, a mute role could not be given to user '+member.user.tag+" "+err);
                });
            }, function(err){console.error(err);});
        }
    }, function(err){console.log('guildMemberAdd '+err);});
}

//Welcome a new member, add roles if setup
function welcomeNewMember(member){
    if(member!== null){
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
        dao.getNationJoin(member.guild).then(function(enabled){
            if(enabled){
                tools.getRandomNation(member.guild).then(function(res){
                    member.roles.add(member.guild.roles.cache.get(res.role_id)).catch(function(err){
                        console.error('getNationJoin '+err);//ADD THIS ON THE REAL USE
                    });
                }, function(err){
                    console.error('getNationJoin '+err);//ADD THIS ON THE REAL USE
                });
            }
        }, function(err){console.error('guildMemberAdd '+err);});
        //notifyNewMember(member);
    }else{
        console.error('Member is null');
    }
}

/*function hasPermission(member, permission){
    let hasPermission = false;
    member.roles.cache.every(function(role){
        console.log('===============');
        console.log(role.permissions);
        console.log(permission);
       if(rmember.has(permission)){
           console.log('permission ok');
           hasPermission = true;
       }
    });
    return hasPermission;
}*/

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
            target.roles.remove(role,"Unmuted by ").catch(function(err){
                console.error('MUTE '+err);
                message = 'Error muting user: '+err;
                return message;
            });
            //interaction.reply({ content: 'User unmuted', ephemeral: true });
            message = 'User unmuted';
        } else {
            //Mute user
            target.roles.add(role,"Muted by ").catch(function(err){
                console.error('MUTE '+err);
                message = 'Error muting user: '+err;
                return message;
            });
            //interaction.reply({ content: 'User muted', ephemeral: true });
            message = 'User muted';
        }
    }else{
        //interaction.reply({ content: 'You are not allowed to mute or unmute this user here.', ephemeral: true });
        message = 'You are not allowed to mute or unmute this user here.';
    }
    return message;
}

async function toggleWhitelist(member){
    let message;
    if(member){
        let whitelistedRows = await dao.getWhiteListedAdmins(member.guild);
        let whitelisted = whitelistedRows && whitelistedRows.rows.find(row => row.user_id == member.user.id);

        if(whitelisted){
            res = await dao.blacklistAdmin(member.user, member.guild).catch(function(err){
                message = 'Error: '+err;
                return message;
            });
            message = 'You will not receive generic notifications anymore.';

        }else if(member.xissions.has(PermissionsBitField.Flags.ManageMessages)){
            let res = await dao.whitelistAdmin(member.user, member.guild).catch(function(err){
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

module.exports = {
    notifyNewMember: notifyNewMember,
    muteUnmute: muteUnmute,
    toggleWhitelist: toggleWhitelist
}