const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const { request } = require('undici');
const dao = require('./dao');
const port = process.env.WEBPORT || 80;
const publicAddress = process.env.PUBLIC_ADDRESS;
const clientId = process.env.APPLICATION_ID;
const clientSecret = process.env.APPLICATION_SECRET;
const authUrl = process.env.AUTH_URL;
const cookieSecret = process.env.COOKIE_SECRET;

const root = __dirname + '/www/';
const index = 'index.html';

const app = express();

let client;

function init(discordClient) {
  client = discordClient;

  //Start server
  app.listen(port, () => {
    console.log(`The website is running on port ${port}`);
  });
}

app.use(session({
  store: new (require('connect-pg-simple')(session))({
    pool : dao.pool,
  }),//Store the sessions in the database
  secret: cookieSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
}));
//TODO: https
// Configuring sessions
/*
const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
  secret: cookieSecret,
  saveUninitialized: true,
  cookie: { maxAge: oneDay,
            secure: true },
  resave: false
})); 
*/

function generateRandomString() {
  let randomString = '';
  const randomNumber = Math.floor(Math.random() * 10);

  for (let i = 0; i < 20 + randomNumber; i++) {
    randomString += String.fromCharCode(33 + Math.floor(Math.random() * 94));
  }

  return randomString;
}

// middleware to test if authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) next();
  else next('route');
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

function errorDisplay(errs) {
  let string;
  if (!Array.isArray(errs));
    errs = [errs];
  errs.forEach(err => {
    string = 'An error occured: ' + err.name + ' : ' + err.message + '\n<table>';
    console.error(err);
    if (err.business) {
      for (i = 0; i < err.business.length; i++) {
        string += '<tr><td>' + err.business[i] + '</td></tr>\n';
      }
    }
    string += '</table>';
  });
return string;
}

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
    console.error(err);
  });
}

/**
   * @param {Array<String>} guilds 
   * @returns Array containg guild, channels[], error tuple
   */
async function getGuildChannels(guilds) {
  let guildRes = [];
  for (i = 0; i < guilds.length; i++) {
    const guild = client.guilds.resolve(guilds[i].id);
    if (!guild) {
      guildRes.push({
        guild: { id: guilds[i].id }, errors: [errorContext({
          name: 'guildNotFound',
          message: 'Cannot fetch guild ' + guilds[i].id
        }, 'at getGuildChannels')]
      });
      continue;//Skip to next guild
    };

    const channels = await guild.channels.fetch();
    if (!channels) {
      guildRes.push({
        guild: { id: guilds[i].id }, errors: [errorContext({
          name: 'channelNotFound',
          message: 'Cannot fetch channels for guild ' + guild.name
        }, 'at getGuildChannels')]
      });
      continue;
    }

    guildRes.push({ guild: guild, channels: channels });
  }
  return guildRes;
};

function toColorCode(decimal) {
  var s = '000000' + decimal.toString(16);
  return '#' + s.substring(s.length - 6);
}

async function generateAdminForms(userGuilds) {
  let res = '';
  let botGuilds = await dao.getGuilds();

  //Partition guilds known and unknown to the bot into two lists
  function partition(array) {
    return array.reduce(([pass, fail], elem) => {
      return botGuilds.rows.some(botGuild => botGuild.id === elem.id)
        ? [[...pass, elem], fail] : [pass, [...fail, elem]];
    }, [[], []]);
  };
  const [commonGuilds, otherGuilds] = partition(userGuilds);
  //list of guilds and channel from the bot client view
  let guildChannels = await getGuildChannels(commonGuilds);
  //Get the properties for all the guilds
  let propertiesResult = await dao.getGuildProperties(commonGuilds.map(guild => guild.id));
  let properties = propertiesResult.rows;
  //Add the nations to the properties
  for (i = 0; i < properties.length; i++) {
    let nationsResult = await dao.getNations(properties[i].id);
    properties[i].nations = nationsResult.rows ? nationsResult.rows : [];
  }

  //Cross discord client data and database properties
  for (i = 0; i < guildChannels.length; i++) {
    if(!guildChannels[i].guild.roles)
      continue;
    for (j = 0; j < properties.length; j++) {
      if (guildChannels[i].guild.id === properties[j].id) {
        guildChannels[i].properties = properties[j];
        guildChannels[i].roles = await guildChannels[i].guild.roles.fetch().catch(
          err => guildChannels[i].errors.push(errorContext(err, 'at generateAdminForms')));
        continue;
      }
    }
  }

  //Display client discord channels forms for managed guilds
  guildChannels.forEach(function (guildWithChannel) {

    res += `<form method="POST"><div class="oneguild" id="${guildWithChannel.guild.id}">`;//Open guild div
    if (guildWithChannel.errors) {
      errorLog(guildWithChannel.errors);
      res += errorDisplay(errorContext(guildWithChannel.errors, 'at generateAdminForms')) + '</div></form>';
    }
    else {
      res += `<h2 class="guildname">${guildWithChannel.guild.name}</h2><image class="guildimage" src="${guildWithChannel.guild.iconURL()}" alt="Guild profile picture">`;
      //Welcome channel select
      res += '<div>Welcome channel<select class="w3-input" name="welcome-channel">'
        + '<option value="">--Please choose an option--</option>';
      guildWithChannel.channels.forEach(function (channel) {
        console.log('Discord: ' + channel.id + 
        ' Database: ' + guildWithChannel.properties.welcome + 
        ' Comparison: ' + (channel.id === guildWithChannel.properties.welcome));
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.welcome ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += '</select></div>';

      res += '<div>Information channel<select class="w3-input" name="information-channel">'
        + '<option value="">--Please choose an option--</option>';
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.information ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += '</select></div>';

      res += '<div>Starboard channel<select class="w3-input" name="starboard-channel">'
        + '<option value="">--Please choose an option--</option>';
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.starboard  ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += '</select></div>';
      res += `<div>Number of stars required<input class="w3-input" name="nb_starboard" type="number" min=0 max=1024 value=${guildWithChannel.properties.nb_star}></div>`;
      res += `<div>Delay to mark user as inactive<input name="inactive" class="w3-input" type="number" min=0 max=1024 value=${guildWithChannel.properties.active_delay}></div>`;
      res += `<div class="inline"><div>Guild is frozen</div><input class="w3-input" type="checkbox" name="frozen" ${guildWithChannel.properties.is_frozen ? 'checked' : ''}></div>`;
      //Existing nations
      guildWithChannel.properties.nations.forEach(function (nation) {
        res += `<div>Name<input class="w3-input" name="name" value="${nation.name}"></div>`;
        res += `<div>Description<input class="w3-input" name="description" value="${nation.description}"></div>`;
        res += `<div>Thumbnail<input class="w3-input" name="thumbnail" value="${nation.thumbnail}"></div>`;//TODO: Display current thumbnail
        res += `<div class="inline"><div>Color</div><div><input class="w3-color" type="color" name="color" value="${toColorCode(nation.color)}"></div></div>`;
        //res += `<div>Name<input class="w3-input" name="message"></div>`; TODO: Select message from the UI
        //TODO: Select role from list
        res += `<div>Role<select class="w3-input" name="role_${nation.name}">`
          + '<option value="">--Please choose an option--</option>';
        guildWithChannel.roles.forEach(role => {
          res += `<option value="${role.id}" ${role.id === nation.role ? 'selected' : ''}>${role.name}</option>`;
        })
        res += `</select></div>`;
        res += `<div class="inline"><div>Is a nation?</div><input class="w3-input" type="checkbox" name="isunique" ${nation.isunique ? 'checked' : ''}></div>`;//TODO add help context? CSS?
        res += `<input type="hidden" class="w3-input" name="ranking" value="${nation.anking}">`;
      });
      //TODO: MOVE NATIONS AROUND
      //TODO: ADD NEW NATION
      res += '<input type="submit" />';
      res += '</div></form>';//End Guild
    }
    /**
     * guilds.id, guilds.shares_message_id, guilds.active_delay, guilds.nb_star, guilds.is_frozen, '
            +'channels.welcome, channels.information, channels.starboard '
     */
  });
  //Display unmanaged guilds
  otherGuilds.forEach(otherGuild => {
    res += '<div>MAGES. isnt in ' + otherGuild.name + ' yet</div>\n';//Guild unknown by MAGES.
  });
  return res;
}

//Connect to discord by getting the token then the user object
async function connect(code) {
  let user;
  if (code) {
    let token = await getDiscordToken(code).catch(err => {
      throw errorContext(err, 'Unable to get discord token with code ' + code);
    });
    if (token) {
      let user = await getDiscordUser(token).catch(err => {
        throw errorContext(err, 'Unable to get discord user with token', token); //Token is only going to be visible in the logs
      });
      user.guilds = await getDiscordGuilds(token).catch(err => {
        throw errorContext(err, 'Unable to get discord guilds with token', token);
      });
      return user;
    } else {
      throw errorContext({ name: 'incorrectToken', message: 'at webpage.connect' }, 'There was an issue with the token', token);
    }
  } else {
    throw errorContext({ name: 'missingApiCode', message: 'at webpage.connect' }, 'API Code missing from the URL');
  }
}

//Login logic, redirected from discord
app.get('/login', function (req, res, next) {
  //Checks if a code is provided
  if (!req.query || !req.query.code) res.redirect(401, '/');
  //Checks for clickjacking
  if (req.session.state !== req.query.state)
    return next(errorContext({ name: 'incorrectToken', message: 'at webpage.connect' }, 'You may have been clickjacked', 'generated: ' + req.session.state + ' provided: ' + req.query.state));
  //Attempts to connect to discord API
  connect(req.query.code).then(function (user) {
    //Prevent session fixing attacks
    req.session.regenerate(function (err) {
      if (err) {
        next(errorContext(err, 'Unable to regenerate session'));
      }
      req.session.user = user;//Store the user in the session
      //Keep the right tab after redirection
      req.session.page = 'settings';
      //Todo: Save session in the database here
      // save the session to the store before redirection to ensure page
      // load does not happen before session is saved
      req.session.save(function (err) {
        if (err) {
          return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
        }
        res.redirect('/');
      });
    });

  }, function (err) {
    next(errorContext(err, 'Could not authentify you to the discord API'));
  });
});

//Logout logic
app.get('/logout', function (req, res, next) {
  // clear the user from the session object and save.
  // this will ensure that re-using the old session id
  // does not have a logged in user
  req.session.user = null;

  //TODO: Remove cookie from the database

  req.session.save(function (err) {
    if (err) next(err);

    // regenerate the session, which is good practice to help
    // guard against forms of session fixation
    req.session.regenerate(function (err) {
      if (err) next(err);
      res.redirect('/');
    });
  });
});

function authentificationBlock(state) {
  return '<div id="info">Please log in before you continue</div>\n' +
    '<a id="login" style="display: block;" href="' + authUrl + '&state=' + state + '">Identify Yourself</a>'
}

//Register all files to endpoints in the www folder
fs.readdirSync(root).forEach(file => {
  if (file != index) {
    app.get('/' + file, (req, res) => {
      var options = {
        root: root
      };
      res.sendFile(file, options);
    })
  }
});

async function getDiscordToken(code) {
  let redirect_uri = publicAddress + 'login';
  //Get the token from Discord
  const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri,
      scope: 'identify guilds guilds.members.read'
    }).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
  });
  let res = await tokenResponseData.body.json();
  if (res.error) throw ({ name: res.error, message: res.error_description });
  return res;
}

async function getDiscordUser(oauthData) {
  //Get the identification data from the token
  userResult = await request('https://discord.com/api/users/@me', {
    headers: {
      authorization: `${oauthData.token_type} ${oauthData.access_token}`, //oauthData.refresh_token, oauthData.expires_in
    },
  });
  //Fill the user object
  let user = await userResult.body.json();
  if (user.error) throw ({ name: user.error, message: user.error_description });
  return user;
}

//Get the guilds where the member is admin
async function getDiscordGuilds(oauthData) {
  //Get the guild data from the token
  guildResult = await request('https://discord.com/api/users/@me/guilds', {
    headers: {
      authorization: `${oauthData.token_type} ${oauthData.access_token}`, //oauthData.refresh_token, oauthData.expires_in
    },
  });
  //Fill the guild object
  let guilds = await guildResult.body.json();
  if (guilds.error) throw ({ name: guilds.error, message: guilds.error_description });
  //Filter all the guilds where the user is not admin
  guilds = guilds.filter(guild => {
    return guild.permissions >> 3 & 0x1;
  });

  return guilds;
}

//TODO: Refresh token?

//Page for authentified user
app.get('/', isAuthenticated, async (req, response, next) => {
  let user = req.session.user;
  let accountInfo = 'Welcome ' + user.username + '#' + user.discriminator + '<div><a href="/logout">log out</a></div>\n';
  let generateAdminFormsError;
  let adminForms = await generateAdminForms(user.guilds).catch(err => {
    generateAdminFormsError = errorContext(err, 'Could not generate administration forms');
  });
  if (generateAdminFormsError) return next(generateAdminFormsError);
  //Load the authentification URL parameter
  fs.readFile(root + index, 'utf8', function (fileReadError, data) {
    if (fileReadError) {
      return next(errorContext(fileReadError, 'Could not read file ' + index));
    }
    var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, accountInfo)
      .replace(/{LOAD_PAGE}/g, req.session.page ? '<script>showPage("' + req.session.page + '")</script>' : '')
      .replace(/{ADMIN_FORMS}/g, adminForms);
    return response.send(result);
  });
});

//Page for unauthentificated user
app.get('/', async (req, response, next) => {
  req.session.state = generateRandomString();
  //Load the authentification URL parameter
  fs.readFile(root + index, 'utf8', function (fileReadError, data) {
    if (fileReadError) {
      return next(errorContext(fileReadError, 'Unable to find index file'));
    }
    req.session.save(function (err) {
      if (err) {
        return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
      }
      var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, authentificationBlock(encodeURIComponent(req.session.state)))
        .replace(/{LOAD_PAGE}/g, req.session.page ? '<script>showPage("' + req.session.page + '")</script>' : '')
        .replace(/{ADMIN_FORMS}/g, 'Please connect with discord to manage the bot');
      return response.send(result);
    });
  });
});

//Formatted error display
app.use(async (error, req, res, next) => {
  req.session.state = generateRandomString();
  //Load the authentification URL parameter
  fs.readFile(root + index, 'utf8', function (fileReadError, data) {
    if (fileReadError) {
      return next(errorContext(fileReadError, 'Unable to find index file'));
    }
    errorLog(error);
    req.session.save(function (err) {
      if (err) {
        return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
      }
      result = data.replace(/{ERROR_BLOCK}/g, errorDisplay(error) + '\n<script>showError();</script>').replace(/{AUTHENTIFICATION_BLOCK}/g, '');
      return res.status(500).send(result);
    });
  });
});

//Unformatted error display
app.use(function (err, req, res, next) {
  errorLog(err);
  res.status(500).send(errorDisplay(err));
});

module.exports = {
  init: init
}