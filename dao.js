const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

function getNations(guild){
    var query = {
        text: 'SELECT * from nations WHERE nations.guild_id = $1 ORDER BY ranking',
        values: [guild.id]
    };
    return pool.query(query).catch(function(err){console.error('getNations() '+err);});
}

function getEventNations(guild){
    var query = {
        text: 'SELECT * from event_nations WHERE nations.guild_id = $1 ORDER BY ranking',
        values: [guild.id]
    };
    return pool.query(query).catch(function(err){console.error('getNations() '+err);});
}

function registerGuild(guild){
    var query = {
        text: 'INSERT INTO guilds(id, name) VALUES($1, $2)',
        values: [guild.id, guild.name]
    };
    pool.query(query).catch(function(err){console.error('registerGuild() '+err);});
}

function setField(table, column, id, value){
    let query = {
        text: 'UPDATE '+table+' SET '+column+' = $2 WHERE id = $1',
        values: [id, value]
    };
    pool.query(query).catch(function(err){
        console.error('setField(): '+err);
    });
}

function setFieldByGuild(table, column, guild, id, value){
    let query = {
        text: 'UPDATE '+table+' SET '+column+' = $3 WHERE id=$1 AND guild = $2',
        values: [id, guild.id, value]
    };
    pool.query(query).catch(function(err){
        console.error('setField(): '+err);
    });
}

function getFields(table, columns, id){
    let selector = columns[0];
    for(let i = 1; i < columns.length; i++){
        selector = selector+', '+columns[i];
    }
    let query = {
        text: 'SELECT '+selector+' FROM '+table+' WHERE id=$1',
        values: [id]
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getFields '+err+'\n Query: '+query.text);
    });
}

function getField(table, column, id){
    let query = {
        text: 'SELECT '+column+' FROM '+table+' WHERE id=$1',
        values: [id]
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getField '+err);
    });
}

function getFieldByGuild(table, column, guild, id){
    let query = {
        text: 'SELECT '+column+' FROM '+table+' WHERE id=$1 AND guild=$2',
        values: [id, guild]
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getField '+err);
    });
}

function addMute(guildId, id){
    let query = {
        text: 'INSERT INTO punishments (guild, id, punishment) '+
        "VALUES ($1, $2, $3)"+
        "ON CONFLICT (guild, id) DO UPDATE "+
        "SET punishment = $3;",
        values: [guildId,id,"muted"]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.addMute '+err);
    });
}
function addBan(guildId, id){
    let query = {
        text: 'INSERT INTO punishments (guild, id, punishment) '+
        "VALUES ($1, $2, $3)"+
        "ON CONFLICT (guild, id) DO UPDATE "+
        "SET punishment = $3;",
        values: [guildId,id,"banned"]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.addMute '+err);
    });
}

function removePunishment(guild, id){
    let query = {
        text: 'DELETE from punishments where guild=$1 AND id=$2;',
        values: [guild, id]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.removePunishment '+err);
    });
}
function getPunishment(guild, id){
    return getFieldByGuild("punishments", "punishment", guild, id);
}

function getMutes(guild){
    let query = {
        text: "SELECT id FROM punishments WHERE guild=$1 AND punishment=$2",
        values: [guild, "muted"]
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getField '+err);
    });
}
function getBans(guild){
    let query = {
        text: "SELECT id FROM punishments WHERE guild=$1 AND punishment=$2",
        values: [guild, "banned"]
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getField '+err);
    });
}

function updateShareMessage(guild, message_id){
    setField('guilds', 'shares_message_id', guild.id, message_id);
}

function enableNationJoin(guild){
    setField('guilds', 'random_assign_nation', guild.id, true);
}

function disableNationJoin(guild){
    setField('guilds', 'random_assign_nation', guild.id, false);
}

function updateActiveRole(guild, activeRoles){
    clearActiveRole(guild);
    activeRoles.forEach(function(role){
        let query = {
            text: "INSERT INTO active_role (guild, id) VALUES ($1,$2)",
            values: [guild, role.id]
        };
        pool.query(query).catch(function(err){
            console.error('updateActiveRole '+err);
        });
    });
    //setField('guilds', 'active_role_id', guild.id, activeRoleIDs);
}

function updateActiveDelay(guild, value){
    setField('guilds', 'active_delay', guild.id, value);
}

function clearActiveRole(guild){
    let query = {
        text: "DELETE FROM active_role WHERE guild=$1",
        values: [guild.id]
    };
    pool.query(query).catch(function(err){
        console.error('clearActiveRole '+err);
    });
}

function setDefaultActiveRole(guild, id){
    let query = {
        text: "UPDATE active_role SET def_give=FALSE WHERE guild=$1 AND def_give=TRUE",
        values: [guild.id]
    };
    pool.query(query).then(function(result){
        if(id){
            query = {
                text: "UPDATE active_role SET def_give=TRUE WHERE guild=$1 AND id=$2",
                values: [guild.id,id.id]
            };
            pool.query(query).catch(function(err){
                console.error('setDefaultActiveRole add '+err);
            });
        }
    },function(err){
        console.error('setDefaultActiveRole remove '+err);
    });
}

function getActiveRoles(guild, defaultToGive){
    let condition = "";
    if(defaultToGive){
        condition = " AND def_give = TRUE";
    }
    let query = {
        text: "SELECT id FROM active_role WHERE guild=$1"+condition,
        values: [guild.id]
    };
    return pool.query(query).then(function(result){
        let roleList = [];
        result.rows.forEach(function(row){
            roleList.push(row.id);
        });
        return roleList;
    },function(err){
        console.error('getActiveRoles '+err);
    });
}

function getActiveDelay(guild){
    return getField("guilds","active_delay",guild.id).then(function(res){
        return res.rows[0].active_delay;
    }, function(err){console.error('getActiveRoles() '+err);
                     return null;
                    });
}

function getStarAmount(guild){
    return getField('guilds', 'nb_star', guild.id).then(function(res){
        return res.rows[0].nb_star;
    },function(err){console.error('getStarAmount() '+err);
                    return 0;
                   });
}

function setStarAmount(guild, amount){
    let query = {
        text: "UPDATE guilds SET nb_star=$1 WHERE id=$2",
        values: [amount, guild.id]
    };
    return pool.query(query).catch(function(err){console.error('setStarAmount() '+err);
                                                 return null;
                                                });
}

function getStarboardChannel(guild){
    return getField('guilds', 'starboard_channel_id', guild.id).then(function(res){
        return res.rows[0].starboard_channel_id;
    },function(err){console.error('getStarboardChannel() '+err);
                    return null;
                   });
}

function setStarboardChannel(guild, channel){
    let query = {
        text: "UPDATE guilds SET starboard_channel_id=$1 WHERE id=$2",
        values: [channel.id, guild.id]
    };
    return pool.query(query).catch(function(err){
        console.error('setStarboardChannel() '+err);
        return null;
    });
}

function getShareMessage(guild){
    return getField('guilds', 'shares_message_id', guild.id).then(function(res){
        return res.rows[0].shares_message_id;
    },function(err){
        console.error('getShareMessage() '+err);
        return null;
    });
}

function getNationJoin(guild){
    return getField('guilds', 'random_assign_nation', guild.id).then(function(res){
        if(res!==undefined){
            return res.rows[0].random_assign_nation;
        }else{
            console.error('No value for random assign found');
            return false;
        }
    });
}

function getShareMessage(guild){
    return getField('guilds', 'shares_message_id', guild.id).then(function(res){
        return res.rows[0].shares_message_id;
    },function(err){console.error('getShareMessage() '+err);
                    return null;
                   });
}

function setInfoChannel(infoChannel){
    setField('guilds', 'information_channel_id', infoChannel.guild.id, infoChannel.id);
}

function setWelcomeChannel(welcomeChannel){
    setField('guilds', 'welcome_channel_id', welcomeChannel.guild.id, welcomeChannel.id);
}

function getWelcomeChannel(guild){
    return getField('guilds', 'welcome_channel_id', guild.id).then(function(res){
        if(res!==undefined){
            return res.rows[0].welcome_channel_id;
        }else{
            console.error('No welcome channel found');
            return null;
        }
    });
}

function getInfoChannel(guild){
    return getField('guilds', 'information_channel_id', guild.id).then(function(res){
        if(res.rows!==undefined){
            return res.rows[0].information_channel_id;
        }else{
            console.error('No welcome channel found');
            return null;
        }
    });
}

function updateMessageId(role, messageId){
    let query = {
        text: 'UPDATE nations SET message_id = $1 WHERE name = $2 AND guild_id = $3',
        values: [messageId, role.name, role.guild.id]
    };
    pool.query(query).then(function(result){
    }, function(err){
        console.error("Could not execute querey updateMessageId"+err);
    });
}

function createNation(name, description, thumbnail, message_id, role, isUnique){
    let colorCode;
    colorCode = role.color;
    let query = {
        text: 'INSERT INTO nations(name, description, color, thumbnail, message_id, role_id, guild_id, isUnique) VALUES($1, $2, $3, $4, $5, $6, $7, $8);',
        values: [name, description, colorCode , thumbnail, message_id, role.id, role.guild.id, isUnique]
    };
    let exists = {
        text: 'SELECT * FROM nations WHERE nations.name = $1 AND nations.guild_id = $2;',
        values: [name, role.guild.id]
    };
    let remove = {
        text: 'DELETE FROM nations WHERE nations.name = $1  AND nations.guild_id = $2;',
        values: [name, role.guild.id]
    };
    let query2 = {
        text: 'INSERT INTO nations(name, description, color, thumbnail, message_id, role_id, guild_id, isUnique) VALUES($1, $2, $3, $4, $5, $6, $7, $8) '+
        'ON CONFLICT ON CONSTRAINT is_nation_unique DO UPDATE SET description=$2, color=$3, thumbnail=$4, message_id=$5, role_id=$6, isunique=$8 WHERE nations.name=$1 AND nations.guild_id=$7;',
        values: [name, description, colorCode , thumbnail, message_id, role.id, role.guild.id, isUnique]

    };
    return pool.query(query2).catch(function(err){
        console.error('createNation '+err);
    });
}

function createEventNation(name, description, thumbnail, message_id, channel, role, isUnique){
    let colorCode;
    colorCode = role.color;
    let query = {
        text: 'INSERT INTO nations(name, description, color, thumbnail, message_id, role_id, guild_id, channel, isUnique) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9);',
        values: [name, description, colorCode , thumbnail, message_id, role.id, role.guild.id, channel, isUnique]
    };
    let exists = {
        text: 'SELECT * FROM nations WHERE nations.name = $1 AND nations.guild_id = $2;',
        values: [name, role.guild.id]
    };
    let remove = {
        text: 'DELETE FROM nations WHERE nations.name = $1  AND nations.guild_id = $2;',
        values: [name, role.guild.id]
    };
    let query2 = {
        text: 'INSERT INTO nations(name, description, color, thumbnail, message_id, role_id, guild_id, isUnique) VALUES($1, $2, $3, $4, $5, $6, $7, $8) '+
        'ON CONFLICT ON CONSTRAINT is_nation_unique DO UPDATE SET description=$2, color=$3, thumbnail=$4, message_id=$5, role_id=$6, channel=$8, isunique=$9 WHERE nations.name=$1 AND nations.guild_id=$7;',
        values: [name, description, colorCode , thumbnail, message_id, role.id, role.guild.id, channel, isUnique]

    };
    return pool.query(query2).catch(function(err){
        console.error('createEventNation '+err);
    });
}

function removeNation(guild, name){
    let query = {
        text: 'DELETE from nations where name=$1 AND guild_id=$2;',
        values: [name, guild.id]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.removeNation '+err);
    });
}

function removeEventNation(guild, name){
    let query = {
        text: 'DELETE from event_nations where name=$1 AND guild_id=$2;',
        values: [name, guild.id]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.removeEventNation '+err);
    });
}

function getLocalPowerLevels(guild){
    let query= {
        text: 'SELECT * FROM administration WHERE guild = $1;',
        values: [guild.id]
    };
    return pool.query(query).then(function(res){
        return res;
    },function(err){
        console.error('getLocalPowerLevels() '+err);
    });
}

function blacklistAdmin(user, guild){// DO NEVER USE THE TAG TO RESEARCH A USER, ANY CHANGE WON'T BE REFLECTED IN THE DATABASE
    let query= {
        text: 'DELETE FROM admin_whitelist WHERE admin_whitelist.user_id=$1 AND admin_whitelist.guild_id=$2;',
        values: [user.id, guild.id]
    };
    return pool.query(query).catch(function(err){console.error('blacklistAdmin() '+err);});
}

function whitelistAdmin(user, guild){// DO NEVER USE THE TAG TO RESEARCH A USER, ANY CHANGE WON'T BE REFLECTED IN THE DATABASE
    let query= {
        text: 'INSERT INTO admin_whitelist(user_id, guild_id, username) values($1 ,$2 ,$3);',
        values: [user.id, guild.id, user.tag]
    };
    return pool.query(query).catch(function(err){console.error('whitelistAdmin() '+err);});
}

function getWhiteListedAdmins(guild){
    let query= {
        text: 'SELECT * FROM admin_whitelist WHERE admin_whitelist.guild_id=$1;',
        values: [guild.id]
    };
    return pool.query(query).then(function(res){return res;},function(err){console.error('getWhiteListedAdmins() '+err);});
}

function assignBotRights(guild, role, powerLevel){

    var pow = powerLevel;
    if(powerLevel>99||powerLevel<0){
        pow = 99;
    }
    let query= {
        text: 'INSERT INTO administration(role, guild, powerlevel) values($1 ,$2 ,$3) ON CONFLICT ON CONSTRAINT is_unique_constraint DO UPDATE SET powerlevel=$3 WHERE administration.role=$1 AND administration.guild=$2;',
        values: [role.id, guild.id, pow]
    };
    pool.query(query).catch(function(err){console.error('assignBotRights() '+err);});
}

function getGuildInfo(guild){
    let fields = ['name', 'information_channel_id', 'welcome_channel_id', 'random_assign_nation', 'shares_message_id', 'active_delay', 'nb_star', 'starboard_channel_id'];
    return getFields("guilds", fields, guild.id).then(guildInfos=>{
        return guildInfos;
    });
}

function getFriendliness(user){
    return getField("users", "friendliness", user).then(friendlinessQuery=>{
        var value = 10;
        if(friendlinessQuery.rows.length > 0) {
            value = friendlinessQuery.rows[0].friendliness;
        }
        return value;
    }, err=>{console.error(err);});
}

function updateFriendliness(user, increment){
    return getField("users", "friendliness", user).then(friendlinessQuery=>{
        let amount = 10;
        let query;
        if(friendlinessQuery.rows.length > 0){
            amount = friendlinessQuery.rows[0].friendliness + increment;
            query = {
                text:'UPDATE users SET friendliness=$2 WHERE id=$1;',
                values: [user, amount]
            };
        }else{
            amount += increment;
            query = {
                text: 'INSERT INTO users(id, friendliness) values($1, $2);',
                values: [user, amount]
            };
        }
        return pool.query(query).then(function(res){return amount;}).catch(function(err){console.error('updateFriendliness() '+err);});
    });
}

function addTimedEvent(event){
    let date = new Date(event.deadline);
    let query = {
        text: 'INSERT INTO time_events (type, location, deadline, metadata) '+
        'VALUES ($1, $2, $3, $4) '+
        'RETURNING id;',
        values: [event.type, event.location, date , event.metadata]
    };
    return pool.query(query).then(function(res){
        return res.rows[0].id;
    },function(err){
        console.error('dao.addTimedEvent '+err);
    });
}

function removeTimedEvent(event){
    let query = {
        text: 'DELETE FROM time_events '+
        'WHERE id = $1;',
        values: [event.id]
    };
    return pool.query(query).catch(function(err){
        console.error('dao.removeTimedEvent '+err);
    });
}

function getTimedEvents(){
    let query = {
        text: 'SELECT id, type, location, deadline, metadata '+
        'FROM time_events'
    };
    return pool.query(query).then(function(result){
        return result;
    },function(err){
        console.error('getField '+err);
    });
}

function setFrozen(guild, value){
    return setField('guilds', 'is_frozen', guild.id, value);
}

function isFrozen(guild){
    return getField('guilds', 'is_frozen', guild.id);
}

module.exports = {
    addBan: addBan,
    addMute: addMute,
    addTimedEvent: addTimedEvent,
    assignBotRights: assignBotRights,
    blacklistAdmin: blacklistAdmin,
    clearActiveRole: clearActiveRole,
    createEventNation: createEventNation,
    disableNationJoin: disableNationJoin,
    enableNationJoin: enableNationJoin,
    getActiveDelay: getActiveDelay,
    getActiveRoles: getActiveRoles,
    getBans: getBans,
    getEventNations: getNations,
    getFriendliness: getFriendliness,
    getGuildInfo: getGuildInfo,
    getInfoChannel: getInfoChannel,
    getLocalPowerLevels: getLocalPowerLevels,
    getMutes: getMutes,
    getNationJoin: getNationJoin,
    getNations: getNations,
    getPunishment: getPunishment,
    getShareMessage: getShareMessage,
    getStarAmount:getStarAmount,
    getStarboardChannel:getStarboardChannel,
    getTimedEvents: getTimedEvents,
    getWelcomeChannel: getWelcomeChannel,
    getWhiteListedAdmins: getWhiteListedAdmins,
    isFrozen: isFrozen,
    registerGuild: registerGuild,
    removeEventNation: removeEventNation,
    removeNation: removeNation,
    removePunishment: removePunishment,
    removeTimedEvent: removeTimedEvent,
    setDefaultActiveRole: setDefaultActiveRole,
    setFrozen: setFrozen,
    setInfoChannel: setInfoChannel,
    setStarAmount:setStarAmount,
    setStarboardChannel:setStarboardChannel,
    setWelcomeChannel: setWelcomeChannel,
    updateActiveDelay: updateActiveDelay,
    updateActiveRole: updateActiveRole,
    updateFriendliness: updateFriendliness,
    updateMessageId: updateMessageId,
    updateShareMessage: updateShareMessage,
    whitelistAdmin: whitelistAdmin,
    createNation: createNation
};