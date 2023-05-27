const { Pool } = require('pg');
const fs = require('fs');

const ssl_directory = process.env.SSL_DIRECTORY;

const config = {
    connectionString: process.env.DATABASE_STRING,
    // this object will be passed to the TLSSocket constructor
    ssl: {
        rejectUnauthorized: false,
        ca: fs.readFileSync(ssl_directory + '/root.cer').toString(),
        key: fs.readFileSync(ssl_directory + '/client.key').toString(),
        cert: fs.readFileSync(ssl_directory + '/client.cer').toString(),
    },
}

const pool = new Pool(config);
pool
    .connect()
    .then(client => {
        console.log('Connected to database')
        client.release()
    })
    .catch(err => console.error('error connecting', err.stack));

/*function numberArrayToPostgresList(data)
{
    let values = data.map(([k,v]) => `("${k}", ${v})`).join(",");
    return `values (${values})`;
}*/

function getNations(guild_id) {
    var query = {
        text: 'SELECT * from nations WHERE nations.guild = $1 ORDER BY ranking',
        values: [guild_id]
    };
    return pool.query(query).catch(function (err) { console.error('getNations() ' + err); });
}

function registerGuild(guild) {
    var query = {
        text: 'INSERT INTO guilds(id, name) VALUES($1, $2)',
        values: [guild.id, guild.name]
    };
    pool.query(query).catch(function (err) { console.error('registerGuild() ' + err); });
}

function updateGuild(id, name) {
    var query = {
        text: 'INSERT INTO guilds(id, name) VALUES($1, $2) ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name',
        values: [id, name]
    };
    pool.query(query).catch(function (err) { console.error('updateGuild() ' + err); });
}

function removeGuild(id) {
    var query = {
        text:  'DELETE FROM guilds WHERE id=$1',
        values: [id]
    };
    return pool.query(query).catch(function (err) { console.error('removeGuild() ' + err); });
}

function getGuilds() {
    var query = {
        text: 'SELECT id, name from guilds'
    };
    return pool.query(query).catch(function (err) { console.error('getGuilds() ' + err); });
}

function getGuildProperties(guildIds){
    var query = {
        text:'SELECT guilds.id, guilds.shares_message_id, guilds.active_delay, guilds.nb_star, guilds.mute_role, guilds.is_frozen, '
            +'channels.welcome, channels.information, channels.starboard '
            +'FROM guilds LEFT OUTER JOIN channels ON guilds.id = channels.guild '
            +'WHERE guilds.id = ANY($1)',
        values: [guildIds]
    };
    return pool.query(query).catch(function (err) {
        console.error('getGuildProperties() ' + err); });
}

function getChannels(guildId){
    var query = {
        text:'SELECT welcome, information, starboard '
            +'FROM channels WHERE guild = $1',
        values: [guildId]
    };
    return pool.query(query).catch(function (err) { 
        console.error('getGuildProperties() ' + err); });
}

function setField(table, id_column, id, value_column, value) {//TODO: ?????
    let query = {
        text: 'UPDATE ' + table + ' SET ' + column + ' = $2 WHERE id = $1',
        values: [id, value]
    };
    pool.query(query).catch(function (err) {
        console.error('setField(): ' + err);
    });
}

function getField(table, id_column, id, value_column) {
    let query = {
        text: 'SELECT ' + value_column + ' FROM ' + table + ' WHERE ' + id_column + '=$1',
        values: [id]
    };
    return pool.query(query).then(function (result) {
        return result;
    }, function (err) {
        console.error('getField ' + err);
    });
}

function getFieldByGuild(table, column, guild, id) {
    let query = {
        text: 'SELECT ' + column + ' FROM ' + table + ' WHERE id=$1 AND guild=$2',
        values: [id, guild]
    };
    return pool.query(query).then(function (result) {
        return result;
    }, function (err) {
        console.error('getField ' + err);
    });
}

function addMute(guildId, id) {
    let query = {
        text: 'INSERT INTO punishments (guild, id, punishment) ' +
            "VALUES ($1, $2, $3)" +
            "ON CONFLICT (guild, id) DO UPDATE " +
            "SET punishment = $3;",
        values: [guildId, id, "muted"]
    };
    return pool.query(query).catch(function (err) {
        console.error('dao.addMute ' + err);
    });
}

function addBan(guildId, id) {
    let query = {
        text: 'INSERT INTO punishments (guild, id, punishment) ' +
            "VALUES ($1, $2, $3)" +
            "ON CONFLICT (guild, id) DO UPDATE " +
            "SET punishment = $3;",
        values: [guildId, id, "banned"]
    };
    return pool.query(query).catch(function (err) {
        console.error('dao.addBan ' + err);
    });
}

function unBan(guildId, id) {
    let query = {
        text: 'DELETE FROM punishments ' +
            "WHERE guild = $1 AND id = $2 AND punishment = $3 ",
        values: [guildId, id, "banned"]
    };
    return pool.query(query).catch(function (err) {
        console.error('dao.unBan ' + err);
    });
}

function removePunishment(guild, id) {
    let query = {
        text: 'DELETE from punishments where guild=$1 AND id=$2;',
        values: [guild, id]
    };
    return pool.query(query).catch(function (err) {
        console.error('dao.removePunishment ' + err);
    });
}
function getPunishment(guild, id) {
    return getFieldByGuild("punishments", "punishment", guild, id);
}

function getMutes(guild) {
    let query = {
        text: "SELECT id FROM punishments WHERE guild=$1 AND punishment=$2",
        values: [guild, "muted"]
    };
    return pool.query(query).then(function (result) {
        return result;
    }, function (err) {
        console.error('getField ' + err);
    });
}
function getBans(guild) {
    let query = {
        text: "SELECT id FROM punishments WHERE guild=$1 AND punishment=$2",
        values: [guild, "banned"]
    };
    return pool.query(query).then(function (result) {
        return result;
    }, function (err) {
        console.error('getBans ' + err);
    });
}

//TODO: Pass id string
function updateShareMessage(guild, message_id) {
    setField('guilds', 'id', guild.id, 'shares_message_id', message_id);
}

//TODO: Test
function updateActiveRole(guild_id, activeRoles) {
    clearActiveRole(guild_id);
    activeRoles.forEach(function (role) {
        setField('active_role', 'guild', guild_id, 'id', role.id);
    });
}

//Switch param to id
function updateActiveDelay(guild, value) {
    setField('guilds', 'id', guild.id, 'active_delay', value);
}

function clearActiveRole(guild_id) {
    let query = {
        text: "DELETE FROM active_role WHERE guild=$1",
        values: [guild_id]
    };
    pool.query(query).catch(function (err) {
        console.error('clearActiveRole ' + err);
    });
}

function setDefaultActiveRole(guild, id) {
    let query = {
        text: "UPDATE active_role SET def_give=FALSE WHERE guild=$1 AND def_give=TRUE",
        values: [guild.id]
    };
    pool.query(query).then(function (result) {
        if (id) {
            query = {
                text: "UPDATE active_role SET def_give=TRUE WHERE guild=$1 AND id=$2",
                values: [guild.id, id.id]
            };
            pool.query(query).catch(function (err) {
                console.error('setDefaultActiveRole add ' + err);
            });
        }
    }, function (err) {
        console.error('setDefaultActiveRole remove ' + err);
    });
}

function getActiveRoles(guild, defaultToGive) {
    let condition = "";
    if (defaultToGive) {
        condition = " AND def_give = TRUE";
    }
    let query = {
        text: "SELECT id FROM active_role WHERE guild=$1" + condition,
        values: [guild.id]
    };
    return pool.query(query).then(function (result) {
        let roleList = [];
        result.rows.forEach(function (row) {
            roleList.push(row.id);
        });
        return roleList;
    }, function (err) {
        console.error('getActiveRoles ' + err);
    });
}

function getActiveDelay(guild) {
    return getField('guilds', 'id', guild.id, 'active_delay').then(function (res) {
        return res.rows[0].active_delay;
    }, function (err) {
        console.error('getActiveRoles() ' + err);
        return null;
    });
}

function getStarAmount(guild) {
    return getField('guilds', 'id', guild.id, 'nb_star').then(function (res) {
        return res.rows[0].nb_star;
    }, function (err) {
        console.error('getStarAmount() ' + err);
        return 0;
    });
}

function setStarAmount(guild, amount) {
    let query = {
        text: "UPDATE guilds SET nb_star=$1 WHERE id=$2",
        values: [amount, guild.id]
    };
    return pool.query(query).catch(function (err) {
        console.error('setStarAmount() ' + err);
        return null;
    });
}

//TODO: Unify result
function getStarboardChannel(guild) {
    return getField('channels', 'id', guild.id, 'starboard').then(function (res) {
        return res.rows[0].starboard;
    }, function (err) {
        console.error('getStarboardChannel() ' + err);
        return null;
    });
}

function setStarboardChannel(guild, channel) {
    let query = {
        text: "UPDATE channels SET starboard=$1 WHERE guild=$2",
        values: [channel.id, guild.id]
    };
    return pool.query(query).catch(function (err) {
        console.error('setStarboardChannel() ' + err);
        return null;
    });
}

function getShareMessage(guild) {
    return getField('guilds', 'id', guild.id, 'shares_message_id').then(function (res) {
        return res.rows[0].shares_message_id;
    }, function (err) {
        console.error('getShareMessage() ' + err);
        return null;
    });
}

function setInfoChannel(infoChannel) {
    setField('channels', 'guild', infoChannel.guild.id, 'information', infoChannel.id);
}

function setWelcomeChannel(welcomeChannel) {
    setField('channels', 'guild', welcomeChannel.guild.id, 'welcome', welcomeChannel.id);
}

function getWelcomeChannel(guild) {
    return getField('channels', 'guild', guild.id, 'welcome').then(function (res) {
        if (res !== undefined) {
            return res.rows[0].welcome;
        } else {
            console.error('No welcome channel found');
            return null;
        }
    });
}

function getInfoChannel(guild) {
    return getField('channels', 'guild', guild.id, 'information').then(function (res) {
        if (res.rows !== undefined) {
            return res.rows[0].information;
        } else {
            console.error('No welcome channel found');
            return null;
        }
    });
}

function updateMessageId(role, messageId) {
    let query = {
        text: 'UPDATE nations SET message = $1 WHERE name = $2 AND guild = $3',
        values: [messageId, role.name, role.guild.id]
    };
    pool.query(query).then(function (result) {
    }, function (err) {
        console.error("Could not execute querey updateMessageId" + err);
    });
}

function createNation(name, description, thumbnail, message_id, role, isUnique) {
    let colorCode;
    colorCode = role.color;
    let query = {
        text: 'INSERT INTO nations(name, description, color, thumbnail, message, role, guild, isUnique) VALUES($1, $2, $3, $4, $5, $6, $7, $8) ' +
            'ON CONFLICT ON CONSTRAINT is_nation_unique DO UPDATE SET description=$2, color=$3, thumbnail=$4, message=$5, role=$6, isunique=$8 WHERE nations.name=$1 AND nations.guild=$7;',
        values: [name, description, colorCode, thumbnail, message_id, role.id, role.guild.id, isUnique]

    };
    return pool.query(query).catch(function (err) {
        console.error('createNation ' + err);
    });
}

function removeNation(guild, name) {//TODO: Use role instead of name
    let query = {
        text: 'DELETE from nations where name=$1 AND guild=$2;',
        values: [name, guild.id]
    };
    return pool.query(query).catch(function (err) {
        console.error('dao.removeNation ' + err);
    });
}

function replaceGuild(guild, guildInfo){
    //welcomeChannel:body.welcome_channel, informationChannel:body.information_channel,
        //starboardChannel:body.starboard_channel, nbStarboard:body.nb_starboard, inactive:body.inactive && 1, frozen:body.frozen === 'true'
    let query = {
        text: 'INSERT INTO channels values($1,$2,$3,$4) ON CONFLICT ON CONSTRAINT channels_pkey DO UPDATE SET welcome=$2, information=$3, starboard=$4;',
        values: [guild, guildInfo.welcomeChannel, guildInfo.informationChannel, guildInfo.starboardChannel]
    };
    pool.query(query).catch(function (err) {
        console.error('dao.replaceGuild ' + err);
    });
    query = {
        text: 'UPDATE guilds SET nb_star=$1, active_delay=$2, mute_role=$3, is_frozen=$4 where id=$5;',
        values: [guildInfo.nbStarboard, guildInfo.inactive, guildInfo.muteRole ,guildInfo.frozen ,guild]
    };
    pool.query(query).catch(function (err) {
        console.error('dao.replaceGuild ' + err);
    });
}

function replaceNations(guild, nations){
    let query = {text: '', values: []};
    let i=0;//Track nation ranking
    nations.forEach(nation=>{
        let query = {text:`INSERT INTO nations(guild, role, name, description, thumbnail, isunique, ranking) 
        values($${1}, $${2}, $${3}, $${4}, $${5}, $${6}, $${7}) ON CONFLICT ON CONSTRAINT is_nation_unique DO 
            UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, thumbnail=EXCLUDED.thumbnail, isunique=EXCLUDED.isunique, ranking=EXCLUDED.ranking;`,
        values:[guild ,nation.role, nation.name, nation.description, nation.thumbnail, nation.isUnique, i]};
        i++;
        pool.query(query).catch(function (err) {
            console.error('dao.replaceNations ' + err);
        });
    });
}

function removeNations(guild, roles) {//TODO: Implement
    console.log(roles);
    let query = {
        text: `DELETE from nations where role = ANY($1::numeric[]) AND guild=$2;`,
        values: [roles, guild]
    };
    return pool.query(query).then(res=>{console.log(res)}).catch(function (err) {
        console.error('dao.removeNation ' + err);
    });
}

function getLocalPowerLevels(guild) {
    let query = {
        text: 'SELECT * FROM administration WHERE guild = $1;',
        values: [guild.id]
    };
    return pool.query(query).then(function (res) {
        return res;
    }, function (err) {
        console.error('getLocalPowerLevels() ' + err);
    });
}

function blacklistAdmin(user, guild) {
    let query = {
        text: 'DELETE FROM admin_whitelist WHERE admin_whitelist.id=$1 AND admin_whitelist.guild=$2;',
        values: [user, guild]
    };
    return pool.query(query).catch(function (err) { console.error('blacklistAdmin() ' + err); });
}

function whitelistAdmin(user, guild, name) {
    let query = {
        text: 'INSERT INTO admin_whitelist(id, guild, username) values($1 ,$2 ,$3);',
        values: [user, guild, name]
    };
    return pool.query(query).catch(function (err) { console.error('whitelistAdmin() ' + err); });
}

function getWhiteListedAdmins(guild) {
    let query = {
        text: 'SELECT * FROM admin_whitelist WHERE admin_whitelist.guild=$1;',
        values: [guild]
    };
    return pool.query(query).catch(function (err) { console.error('getWhiteListedAdmins() ' + err); });
}

function getFriendliness(user) {
    return getField('users', 'id', user, 'friendliness').then(friendlinessQuery => {
        if (friendlinessQuery.rows.length === 0) {
            return 10;
        }
        return friendlinessQuery.rows.reduce((partialSum, val) => partialSum + val, 0);
    }, err => { console.error(err); });
}

function getFriendlinessByGuild(user, guild) {
    return getFieldByGuild('users', 'friendliness', guild, user).then(friendlinessQuery => {
        if (friendlinessQuery.rows.length === 0) {
            return 10;
        }
        return friendlinessQuery.rows.reduce((partialSum, val) => partialSum + val, 0);
    }, err => { console.error(err); });
}

function updateFriendliness(user, guild, increment) {
    return getFriendlinessByGuild(user, guild).then(value=> {
        amount = value + increment;
        query = {
            text: 'UPDATE users SET friendliness=$2 WHERE id=$1;',
            values: [user, amount]
        };
        return pool.query(query).then(function (res) { return amount; }).catch(function (err) { console.error('updateFriendliness() ' + err); });
    });
}

function setFrozen(guild, value) {
    setField('guilds', 'id', guild.id, 'is_frozen', value);
}

function isFrozen(guild) {
    return getField('guilds', 'id', guild.id, 'is_frozen');
}

/**
 * Get parametrized messages in a guild
 * @param {*} guild 
 * @returns 
 */
function getMessages(guild, type){
    var query = {
        text: 'SELECT * from messages WHERE messages.guild = $1 AND messages.type = $2',
        values: [guild, type]
    };
    return pool.query(query).catch(function (err) { console.error('getMessages() ' + err); });
}

/**
 * Replace all messages of a type in a guild with a new list
 * @param {*} guild id of the guild
 * @param {*} channel id of the channel
 * @param {*} messages array of message ids
 * @param {*} type type of the message(s)
 * @returns 
 */
async function replaceMessages(guild, channel, messages, type){
    if(!Array.isArray(messages))
        messages = [messages];
    var query = {
        text: 'DELETE FROM messages WHERE messages.guild = $1 AND messages.channel = $2 AND messages.type = $3',
        values: [guild, channel, type]
    };
    await pool.query(query).catch(function (err) { console.error('replaceMessages() ' + err); });
    messages.forEach(message=>{
        query = {
            text: 'INSERT INTO messages VALUES($1,$2,$3,$4)',
            values: [guild, channel, message, type]
        };
        return pool.query(query).catch(function (err) { console.error('replaceMessages() ' + err); });
    });
}

module.exports = {
    pool: pool,
    addBan: addBan,
    addMute: addMute,
    blacklistAdmin: blacklistAdmin,
    clearActiveRole: clearActiveRole,
    getActiveDelay: getActiveDelay,
    getActiveRoles: getActiveRoles,
    getBans: getBans,
    getFriendliness: getFriendliness,
    getInfoChannel: getInfoChannel,
    getLocalPowerLevels: getLocalPowerLevels,
    getMessages: getMessages,
    getMutes: getMutes,
    getNations: getNations,
    getPunishment: getPunishment,
    getShareMessage: getShareMessage,
    getStarAmount: getStarAmount,
    getStarboardChannel: getStarboardChannel,
    getWelcomeChannel: getWelcomeChannel,
    getWhiteListedAdmins: getWhiteListedAdmins,
    isFrozen: isFrozen,
    registerGuild: registerGuild,
    updateGuild: updateGuild,
    removeGuild: removeGuild,
    getGuilds: getGuilds,
    getGuildProperties: getGuildProperties,
    getChannels: getChannels,
    removeNation: removeNation,
    replaceGuild: replaceGuild,
    replaceMessages: replaceMessages,
    replaceNations: replaceNations,
    removeNations: removeNations,
    removePunishment: removePunishment,
    setDefaultActiveRole: setDefaultActiveRole,
    setFrozen: setFrozen,
    setInfoChannel: setInfoChannel,
    setStarAmount: setStarAmount,
    setStarboardChannel: setStarboardChannel,
    setWelcomeChannel: setWelcomeChannel,
    unBan: unBan,
    updateActiveDelay: updateActiveDelay,
    updateActiveRole: updateActiveRole,
    updateFriendliness: updateFriendliness,
    updateMessageId: updateMessageId,
    updateShareMessage: updateShareMessage,
    whitelistAdmin: whitelistAdmin,
    createNation: createNation
};
