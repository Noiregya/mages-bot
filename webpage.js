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
const inviteLink = process.env.INVITE_LINK;

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
    pool: dao.pool,
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

function generateNationHtml(id, name, description, thumbnail, color, roles, currentRole, isUnique, ranking){
  let res = `<button type="button" class="collapsible">${name ? name: ''}</button>
          <div class="onenation collapsed">
          <div>Name<input class="mB-input" name="name" value="${name ? name: ''}"></div>
          <div>Description<input class="mB-input" name="description" value="${description ? description : ''}"></div>
          <div>Thumbnail<input class="mB-input" name="thumbnail" value="${thumbnail ? thumbnail : ''}"></div>
          <div class="inline"><div>Color</div><div><input class="mB-color" type="color" name="color" value="${color ? toColorCode(color) : ''}"></div></div>
          <div>Role<select class="mB-input" name="role_${name ? name : ''}">
          <option value="">--Please choose an option--</option>`;
          if(roles){
            roles.forEach(role => {
              if(role.name!=='@everyone')
                res += `<option value="${role.id}" ${role.id === currentRole ? 'selected' : ''}>${role.name}</option>`;
            });
          }
          res += `</select></div>
          <div class="inline"><div>Is a nation?</div><input class="mB-input" type="checkbox" name="isunique" ${isUnique ? 'checked' : ''}></div>
          <input type="hidden" class="mB-input" name="ranking" value="${ranking ? ranking : 0}">
          <input type="hidden" class="mB-input" name="id" value="${id ? id : 0}">
          </div><hr>`;
          return res;
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
    if (!guildChannels[i].guild.roles)
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

  //Générer onglets
  res += `<div class="mB-padding-32" style="pointer-events: auto;">
              <div class="mB-bar" id="tabbar">`;
  guildChannels.forEach(function (guildWithChannel) {
    if (!guildWithChannel.errors) {
      res += `<image src="${guildWithChannel.guild.iconURL()}" alt="${guildWithChannel.guild.name}" 
              style="width:64px" class="tab-${guildWithChannel.guild.id} tablinks mB-bar-item mB-button mB-light-grey"
              onclick="toggleGuild('${guildWithChannel.guild.id}')">`;
    }
  });
  res += `<a class="newguild tablinks mB-bar-item mB-button"
                    alt="Invite the bot to a new server" target="popup" 
                    onclick="openDialog('${inviteLink}', 'popup, \`width=600,height=400,top=\${window.outerHeight/2 - 250},left=\${window.outerWidth/2 - 300}\`')"
                    return false;">                
            <svg width="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16.49C11.8011 16.49 11.6103 16.411 11.4697 16.2703C11.329 16.1297 11.25 15.9389 11.25 15.74V7.73999C11.25 7.54108 11.329 7.35031 11.4697 7.20966C11.6103 7.06901 11.8011 6.98999 12 6.98999C12.1989 6.98999 12.3897 7.06901 12.5303 7.20966C12.671 7.35031 12.75 7.54108 12.75 7.73999V15.74C12.75 15.9389 12.671 16.1297 12.5303 16.2703C12.3897 16.411 12.1989 16.49 12 16.49Z" fill="black"/>
            <path d="M16 12.49H8.00001C7.81729 12.4688 7.64874 12.3812 7.5264 12.2438C7.40406 12.1065 7.33646 11.9289 7.33646 11.745C7.33646 11.5611 7.40406 11.3835 7.5264 11.2462C7.64874 11.1088 7.81729 11.0212 8.00001 11H16C16.1989 11 16.3897 11.079 16.5303 11.2197C16.671 11.3603 16.75 11.5511 16.75 11.75C16.75 11.9489 16.671 12.1397 16.5303 12.2803C16.3897 12.421 16.1989 12.5 16 12.5V12.49Z" fill="black"/>
            <path d="M12 21.44C11.8667 21.441 11.7355 21.4065 11.62 21.34L3.87 16.87C3.75818 16.802 3.66552 16.7067 3.60078 16.5929C3.53604 16.4792 3.50136 16.3509 3.5 16.22V7.27C3.49838 7.13855 3.53181 7.00905 3.59684 6.89481C3.66187 6.78057 3.75616 6.68571 3.87 6.62L11.62 2.14C11.7346 2.07607 11.8637 2.04251 11.995 2.04251C12.1263 2.04251 12.2554 2.07607 12.37 2.14L20.12 6.62C20.2364 6.68359 20.3333 6.7777 20.4003 6.89223C20.4672 7.00675 20.5017 7.13735 20.5 7.27V16.27C20.4986 16.402 20.4628 16.5314 20.3962 16.6454C20.3295 16.7593 20.2343 16.854 20.12 16.92L12.37 21.39C12.2536 21.4403 12.1256 21.4577 12 21.44ZM5 15.78L12 19.78L19 15.78V7.7L12 3.7L5 7.7V15.78Z" fill="black"/>
            </svg></a>`;
  res += '</div></div>';

  //Display client discord channels forms for managed guilds
  first = true;
  guildChannels.forEach(function (guildWithChannel) {
    
    res += `<form method="POST"><div ${first ? 'style="display: block;"' : 'style="display: none;"'} class="oneguild" id="${guildWithChannel.guild.id}">`;//Open guild div
    first = false;
    if (guildWithChannel.errors) {
      errorLog(guildWithChannel.errors);
      res += errorDisplay(errorContext(guildWithChannel.errors, 'at generateAdminForms')) + '</div></form>';
    }
    else {
      res += `<div class="guildheader">
              <h2 class="guildname">${guildWithChannel.guild.name}</h2><image class="guildimage" src="${guildWithChannel.guild.iconURL()}" alt="Guild profile picture">`;
      //Welcome channel select
      res += `<div>Welcome channel<select class="mB-input" name="welcome-channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.welcome ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Information channel<select class="mB-input" name="information-channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.information ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Starboard channel<select class="mB-input" name="starboard-channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.starboard ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Number of stars required<input class="mB-input" name="nb_starboard" type="number" min=0 max=1024 value=${guildWithChannel.properties.nb_star}></div>
              <div>Delay to mark user as inactive<input name="inactive" class="mB-input" type="number" min=0 max=1024 value=${guildWithChannel.properties.active_delay}></div>
              <div class="inline"><div>Guild is frozen</div><input class="mB-input" type="checkbox" name="frozen" ${guildWithChannel.properties.is_frozen ? 'checked' : ''}></div>
              </div><hr>
              <a class="mB-button mB-sudo-button" onclick="addNation(event.target)">Create a new nation</a>`;
              
      guildWithChannel.properties.nations.forEach(function(nation){
        res += generateNationHtml(nation.id, nation.name, nation.description, nation.thumbnail, nation.color, guildWithChannel.roles, nation.role, nation.isUnique, nation.ranking);
      });
      //Send the list of guild roles to the client
      res += `<div class="guildRoles" style="display:none">
        {"guild":"${guildWithChannel.guild.id}","roles":${JSON.stringify(guildWithChannel.roles)}}
      </div>`;
      /*
      res+=`<script>
      console.log("Adding guild");
            if (!guilds)
              var guilds = [];
            if (!guilds[${guildWithChannel.guild.id}]){
              guilds[${guildWithChannel.guild.id}] = {};
            }
            guilds[${guildWithChannel.guild.id}].roles=${guildWithChannel.roles};
      </script>`;*/
      //TODO: MOVE NATIONS AROUND
      //TODO: ADD NEW NATION
      res += '<div class="guildfooter"><input class="mB-button" type="submit" />';
      res += '</div></form></div>';//End Guild
    }
    res += `<script>// Collapse and uncollapse collapsibles
      function addNation(target){
        let guild = target.parentNode.id;
        let domRolesElements = document.getElementsByClassName("guildRoles");
        let roles;
        for(let i=0; i < domRolesElements.length; i++){
          console.log(domRolesElements[i].innerHTML.trim());
          let object = JSON.parse(domRolesElements[i].innerHTML.trim());
          console.log(object);
          if(object.guild === guild){
            roles = object.roles;
            break;
          }
        }

        console.log(roles);
        let wrapper= document.createElement('div');
        wrapper.innerHTML = generateNationHtml(null, null, null, null, null, roles, null, null, null);
        console.log(wrapper.childNodes);
        let newNode = wrapper.children[1];
        console.log(newNode);
        newNode.classList.remove('collapsed');
        target.parentNode.insertBefore(wrapper.children[2], target.nextSibling);
        target.parentNode.insertBefore(newNode, target.nextSibling);
      }
      ${generateNationHtml.toString()}
      var coll = document.getElementsByClassName("collapsible");
      for (i = 0; i < coll.length; i++) {
        console.log("loading 1");
        coll[i].addEventListener("click", function() {
          this.classList.toggle("active");
          var content = this.nextElementSibling;
          if (content.style.maxHeight){
            content.style.maxHeight = null;
          } else {
            content.style.maxHeight = content.scrollHeight + "px";
          }
        });
      }</script>`;
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
  return `<div id="info">Please log in before you continue</div>\n
          <a id="login" style="display: block;" href="${authUrl}&state=${state}">Identify Yourself</a>`;
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
  //Save session
  if (req.session) {
    req.session.state = generateRandomString();
    err = await req.session.save();
    if (err)
      return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
  }
  //Load the authentification URL parameter
  let data = fs.readFileSync(root + index, 'utf8');
  if (!data)
    return next(errorContext(fileReadError, 'Unable to find index file'));
  result = data.replace(/{ERROR_BLOCK}/g, errorDisplay(error) + '\n<script>showError();</script>').replace(/{AUTHENTIFICATION_BLOCK}/g, '');
  return res.status(500).send(result);
});

//Unformatted error display
app.use(function (err, req, res, next) {
  errorLog(err);
  res.status(500).send(errorDisplay(err));
});

module.exports = {
  init: init
}