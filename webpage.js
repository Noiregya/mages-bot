const fs = require('node:fs');
const http = require("http");
const https = require("https");
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { request } = require('undici');
const dao = require('./dao');
const business = require('./business');
const {errorContext, errorLog} = require('./tools');
const { PermissionsBitField } = require('discord.js');
const port = process.env.WEBPORT || 80;
const clientId = process.env.APPLICATION_ID;
const clientSecret = process.env.APPLICATION_SECRET;
const cookieSecret = process.env.COOKIE_SECRET;
const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=1237219404868&scope=bot`;


const root = __dirname + '/www/';
const index = 'index.html';
const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

function getAuthUrl(localUrl){
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(localUrl)}login&response_type=code&scope=identify%20guilds`
}

let client;
function init(discordClient) {
  client = discordClient;
  if(process.env.SSL_CERT){
    https
    .createServer(
      // Provide the private and public key to the server by reading each
      // file's content with the readFileSync() method.
      {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
      },
      app
    )
    .listen(port, () => {
      console.log(`The website is running on port ${port}`);
    });
  }else{
    app.listen(port, () => {
      console.log(`The website is running unsecured on port ${port}`);
    });
  }
  
}
app.set('trust proxy', 'loopback');
app.use(bodyParser.urlencoded({extended: false}));
app.use(limiter);

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
  const randomNumber = Math.floor(Math.random() * 10);
  randomCodes = [];
  for (let i = 0; i < 20 + randomNumber; i++) {
    randomCodes.push(0x30 + Math.floor(Math.random() * 0x7e));
  }
  return String.fromCharCode(...randomCodes);
}

// middleware to test if authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) next();
  else next('route');
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

function complementaryText(color){
  let r=(color/0xFFFF)%0xFF,g=(color/0xFF)%0xFF,b=color%0xFF;
  return (r*0.299+g*0.587+b*0.114 > 150 ? 0 : 0xFFFFFF);
}

function generateBetterCheckbox(name, value){
  return `<input class="mB-input" type="checkbox" onClick="checkboxEvent(event.target)" name="${name}_box" ${value ? 'checked' : ''}><input type="hidden" name="${name}" value="${!!value}">`
}
function generateNationHtml(name, description, thumbnail, color, roles, currentRole, isUnique){
  let res = `<button type="button" ${color ? 'style="background-color:'+toColorCode(color)+'CC;color:'+toColorCode(complementaryText(color))+'"' : ''} class="collapsible">${name ? name: ''}</button>
          <div class="onenation collapsed">
          <div>Name<input class="mB-input" name="name" value="${name ? name: ''}" required></div>
          <div>Description<input class="mB-input" name="description" value="${description ? description : ''}"></div>
          <div>Thumbnail<input class="mB-input" name="thumbnail" value="${thumbnail ? thumbnail : ''}"></div>
          <div>Mute role<select class="mB-input" name="role" required>
          <option value="">--Please choose an option--</option>`; 
          if(roles){
            roles.forEach(role => {
              if(role.name!=='@everyone')
                res += `<option value="${role.id}" ${role.id === currentRole ? 'selected' : ''}>${role.name}</option>`;
            });
          }
          res += `</select></div>
          <div class="inline"><div>Exclusive</div>${generateBetterCheckbox('isUnique', isUnique)}</div>
          <a class="mB-button" onclick="deleteNation(event.target)">Delete nation</a>
          <input type="hidden" class="mB-input" name="deleted" value="false">
          </div><hr>`;
          return res;
}

async function generateAdminForms(userGuilds, salt) {
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
                    onclick="openDialog('${inviteLink}', 'popup', 'width=600,height=400,top=\${window.outerHeight/2 - 250},left=\${window.outerWidth/2 - 300}')"
                    return="false">
            <svg width="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16.49C11.8011 16.49 11.6103 16.411 11.4697 16.2703C11.329 16.1297 11.25 15.9389 11.25 15.74V7.73999C11.25 7.54108 11.329 7.35031 11.4697 7.20966C11.6103 7.06901 11.8011 6.98999 12 6.98999C12.1989 6.98999 12.3897 7.06901 12.5303 7.20966C12.671 7.35031 12.75 7.54108 12.75 7.73999V15.74C12.75 15.9389 12.671 16.1297 12.5303 16.2703C12.3897 16.411 12.1989 16.49 12 16.49Z" fill="black"/>
            <path d="M16 12.49H8.00001C7.81729 12.4688 7.64874 12.3812 7.5264 12.2438C7.40406 12.1065 7.33646 11.9289 7.33646 11.745C7.33646 11.5611 7.40406 11.3835 7.5264 11.2462C7.64874 11.1088 7.81729 11.0212 8.00001 11H16C16.1989 11 16.3897 11.079 16.5303 11.2197C16.671 11.3603 16.75 11.5511 16.75 11.75C16.75 11.9489 16.671 12.1397 16.5303 12.2803C16.3897 12.421 16.1989 12.5 16 12.5V12.49Z" fill="black"/>
            <path d="M12 21.44C11.8667 21.441 11.7355 21.4065 11.62 21.34L3.87 16.87C3.75818 16.802 3.66552 16.7067 3.60078 16.5929C3.53604 16.4792 3.50136 16.3509 3.5 16.22V7.27C3.49838 7.13855 3.53181 7.00905 3.59684 6.89481C3.66187 6.78057 3.75616 6.68571 3.87 6.62L11.62 2.14C11.7346 2.07607 11.8637 2.04251 11.995 2.04251C12.1263 2.04251 12.2554 2.07607 12.37 2.14L20.12 6.62C20.2364 6.68359 20.3333 6.7777 20.4003 6.89223C20.4672 7.00675 20.5017 7.13735 20.5 7.27V16.27C20.4986 16.402 20.4628 16.5314 20.3962 16.6454C20.3295 16.7593 20.2343 16.854 20.12 16.92L12.37 21.39C12.2536 21.4403 12.1256 21.4577 12 21.44ZM5 15.78L12 19.78L19 15.78V7.7L12 3.7L5 7.7V15.78Z" fill="black"/>
            </svg></a>`;
  res += '</div></div>';

  //Display client discord channels forms for managed guilds
  first = true;
  guildChannels.forEach(function(guildWithChannel) {
    
    res += `<form method="POST"><div ${first ? 'style="display: block;"' : 'style="display: none;"'} class="oneguild" id="${guildWithChannel.guild.id}" name="${guildWithChannel.guild.id}">`;//Open guild div
    first = false;
    if (guildWithChannel.errors) {
      errorLog(guildWithChannel.errors);
      res += errorDisplay(errorContext(guildWithChannel.errors, 'at generateAdminForms')) + '</div></form>';
    }
    else {
      res += `<div class="guildheader">
              <h2 class="guildname">${guildWithChannel.guild.name}</h2><image class="guildimage" src="${guildWithChannel.guild.iconURL()}" alt="Guild profile picture">`;
      //Welcome channel select
      res += `<input name="guild" type="hidden" value="${guildWithChannel.guild.id}">
              <div>Welcome channel<select class="mB-input" name="welcome_channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {//TODO: exclude categories and non text channels
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.welcome ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Information channel<select class="mB-input" name="information_channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.information ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Starboard channel<select class="mB-input" name="starboard_channel">
              <option value="">--Please choose an option--</option>`;
      guildWithChannel.channels.forEach(function (channel) {
        res += `<option value="${channel.id}" ${channel.id === guildWithChannel.properties.starboard ? 'selected' : ''}>${channel.name}</option>`;
      });
      res += `</select></div>
              <div>Number of stars required<input class="mB-input" name="nb_starboard" type="number" min=0 max=1024 value=${guildWithChannel.properties.nb_star}></div>
              <div>Delay to mark user as inactive<input name="inactive" class="mB-input" type="number" min=0 max=1024 value=${guildWithChannel.properties.active_delay}></div>
              <div>Role<select class="mB-input" name="mute_role" required>
              <option value="">--Please choose an option--</option>`; 
              let currentRole = guildWithChannel.properties.mute_role;
              if(guildWithChannel.roles){
                guildWithChannel.roles.forEach(role => {
                  if(role.name!=='@everyone')
                    res += `<option value="${role.id}" ${role.id === currentRole ? 'selected' : ''}>${role.name}</option>`;
                });
              }
      res += `</select></div>
              <div class="inline"><div>Mute all users on join</div>${generateBetterCheckbox('frozen', guildWithChannel.properties.is_frozen)}</div>
              </div><hr>
              <a class="mB-button" onclick="addNation(event.target)">Create a new nation</a>`;
              //<div class="inline"><div>Guild is frozen</div><input class="mB-input" type="checkbox" name="frozen" ${guildWithChannel.properties.is_frozen ? 'checked' : ''}></div>
              
      for(let i=0; i<guildWithChannel.properties.nations.length; i++){
        let nation = guildWithChannel.properties.nations[i];
        let role = guildWithChannel.roles.get(nation.role);
        let color = role ? role.color : 0x444444 ;
        res += generateNationHtml(nation.name, nation.description, nation.thumbnail, color, guildWithChannel.roles, nation.role, nation.isunique);
      }
      /*guildWithChannel.properties.nations.forEach(function(nation){
        let color = guildWithChannel.roles.get(nation.role).color;
        res += generateNationHtmlnation.name, nation.description, nation.thumbnail, color, guildWithChannel.roles, nation.role, nation.isUnique, nation.ranking);
      });*/
      //Send the list of guild roles to the client
      res += `<div class="guildRoles" style="display:none">
        {"guild":"${guildWithChannel.guild.id}","roles":${JSON.stringify(guildWithChannel.roles)}}
      </div>`;
      //TODO: MOVE NATIONS AROUND
      res += `<div class="guildfooter">
              <input type="hidden" name="salt" value="${salt}">
              <input class="mB-button" type="submit" value="Save changes"/>
              <a class="mB-button" onclick="location.replace('/reload')">Reset values</a>
              </div></form></div>`;//End Guild
    }
  });
  //Client side javascript
  res += `<script>
  function checkboxEvent(target){
    if(target.checked){
      target.nextSibling.value = "true";
    }else{
      target.nextSibling.value = "false";
    }
  }

  function deleteNation(target){
    if(window.confirm("Are you sure you want to remove this nation?")){
      target.nextSibling.nextSibling.value = "true";
      //Content
      target.parentNode.style.display="none";
      //Separation bar
      if(target.parentNode.nextSibling.style){
        target.parentNode.nextSibling.style.display="none";
      }else if(target.parentNode.nextSibling.nextSibling.style){
        target.parentNode.nextSibling.style.display="none";
      }
      //TitleBar
      let button = target.parentNode.previousSibling.previousSibling;
      if(target.parentNode.previousSibling.previousSibling.classList.contains("collapsible"))
        target.parentNode.previousSibling.previousSibling.style.display="none";
      else if(target.parentNode.previousSibling.classList.contains("collapsible")){
        target.parentNode.previousSibling.style.display="none";
      }
      for(let item of target.parentNode.getElementsByTagName('select')){
        item.required=false;
      }
    }
  }

  function addNation(target){
    let guild = target.parentNode.id;
    let domRolesElements = document.getElementsByClassName("guildRoles");
    let roles;
    for(let i=0; i < domRolesElements.length; i++){
      let object = JSON.parse(domRolesElements[i].innerHTML.trim());
      if(object.guild === guild){
        roles = object.roles;
        break;
      }
    }
    let wrapper= document.createElement('div');
    wrapper.innerHTML = generateNationHtml('New nation', null, null, null, roles, null, null);
    let titleBar = wrapper.children[0];
    titleBar.classList.add('active');
    let formContent = wrapper.children[1];
    //formContent.classList.remove('collapsed');
    formContent.style.maxHeight='none';
    target.parentNode.insertBefore(wrapper.children[2], target.nextSibling);
    target.parentNode.insertBefore(formContent, target.nextSibling);
    target.parentNode.insertBefore(titleBar, target.nextSibling);
  }
  ${generateNationHtml.toString()}
  ${generateBetterCheckbox.toString()}
  var coll = document.getElementsByClassName("collapsible");
  for (i = 0; i < coll.length; i++) {
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
  return res;
}

//Login logic, redirected from discord
app.get('/login', function (req, res, next) {
  //Checks if a code is provided
  if (!req.query || !req.query.code) res.redirect(401, '/');
  //Checks for clickjacking
  if (req.session.state !== req.query.state)
    return next(errorContext({ name: 'incorrectToken', message: 'at webpage.connect' }, 'You may have been clickjacked', 'generated: ' + req.session.state + ' provided: ' + req.query.state));
  let fullHost = req.protocol + '://' + req.get('host');
  //Attempts to connect to discord API
  connect(req.query.code, fullHost).then(function (user) {
    //Prevent session fixing attacks
    req.session.regenerate(function (err) {
      if (err) {
        return next(errorContext(err, 'Unable to regenerate session'));
      }
      req.session.user = user;//Store the user in the session
      //Keep the right tab after redirection
      req.session.page = 'settings';
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
    return next(errorContext(err, 'Could not authentify you to the discord API'));
  });
});

//Reload logic, redirected from discord
app.get('/reload', function (req, res, next) {
  //Checks if a code is provided
  if (!req.session.oAuthData) res.redirect(401, '/');
  //Attempts to connect to discord API
  reloadDiscordData(req.session.user).then(function (user) {
    req.session.user = user;//Store the user in the session
    //Keep the right tab after redirection
    req.session.page = 'settings';
    req.session.save(function (err) {
      if (err) {
        return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
      }
      res.redirect('/');
    });
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
    if (err) return next(err);

    // regenerate the session, which is good practice to help
    // guard against forms of session fixation
    req.session.regenerate(function (err) {
      if (err) return next(err);
      res.redirect('/');
    });
  });
});

function authentificationBlock(state, authUrl) {
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

async function getDiscordToken(code, host) {//TODO: Change for https?
  let redirect_uri = `${host}/login`;
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

async function refreshDiscordToken(refreshToken) {
  //Refresh the token from Discord
  const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
  });
  let res = await tokenResponseData.body.json();
  if (res.error) throw ({ name: res.error, message: res.error_description });
  return res;
}

async function getDiscordUser(oAuthData) {
  //Get the identification data from the token
  userResult = await request('https://discord.com/api/users/@me', {
    headers: {
      authorization: `${oAuthData.token_type} ${oAuthData.access_token}`, //oAuthData.refresh_token, oAuthData.expires_in
    },
  });
  //Fill the user object
  let user = await userResult.body.json();
  if (user.error) throw ({ name: user.error, message: user.error_description });
  return user;
}

//Get the guilds where the member is admin
async function getDiscordGuilds(oAuthData) {
  //Get the guild data from the token
  guildResult = await request('https://discord.com/api/users/@me/guilds', {
    headers: {
      authorization: `${oAuthData.token_type} ${oAuthData.access_token}`, //oAuthData.refresh_token, oAuthData.expires_in
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

//Connect to discord by getting the token then the user object
async function connect(code, host) {
  if (code) {
    let oAuthData = await getDiscordToken(code, host).catch(err => {
      throw errorContext(err, 'Unable to get discord token with code ' + code);
    });
    if (oAuthData) {
      let user = await getDiscordUser(oAuthData).catch(err => {
        throw errorContext(err, 'Unable to get discord user with token', oAuthData); //Token is only going to be visible in the logs
      });
      user.oAuthData = oAuthData;
      user.dateOAuth = Date.now();
      user.guilds = await getDiscordGuilds(oAuthData).catch(err => {
        throw errorContext(err, 'Unable to get discord guilds with token', oAuthData);
      });
      return user;
    } else {
      throw errorContext({ name: 'incorrectToken', message: 'at webpage.connect' }, 'There was an issue with the token', token);
    }
  } else {
    throw errorContext({ name: 'missingApiCode', message: 'at webpage.connect' }, 'API Code missing from the URL');
  }
}

//Connect to discord by getting the token then the user object
async function reloadDiscordData(user) {
  let dateOAuth = user.dateOAuth;
  let oAuthData = user.oAuthData;
  //Reload the token
  if(user.oAuthData.expires_in + user.dateOAuth < Date.now()){
    oAuthData = await refreshDiscordToken(user.oAuthData.refresh_token).catch(err => {
      throw errorContext(err, 'Unable to get discord token with refreshToken ', user.refreshToken);
    });
    dateOAuth = Date.now();
  }
  //Reload the user and guilds
  user = await getDiscordUser(oAuthData).catch(err => {
    throw errorContext(err, 'Unable to get discord user with token', oAuthData);
  });
  user.guilds = await getDiscordGuilds(oAuthData).catch(err => {
    throw errorContext(err, 'Unable to get discord guilds with token', oAuthData);
  });
  user.oAuthData = oAuthData
  user.dateOAuth = dateOAuth;
  return user;
}

//Page for authentified user
app.get('/', isAuthenticated, async (req, response, next) => {
  let user = req.session.user;
  let accountInfo = 'Welcome ' + user.username + '#' + user.discriminator + '<div><a href="/logout">log out</a></div>\n';
  let generateAdminFormsError;
  //Securize form to make sure the same person loads the forms and submit it
  let salt = generateRandomString();
  req.session.salt=salt;
  let adminForms = await generateAdminForms(user.guilds, salt).catch(err => {
    generateAdminFormsError = errorContext(err, 'Could not generate administration forms');
  });
  if (generateAdminFormsError) return next(generateAdminFormsError);
  //Load the authentification URL parameter
  fs.readFile(root + index, 'utf8', function (fileReadError, data) {
    if (fileReadError) {
      return next(errorContext(fileReadError, 'Could not read file ' + index));
    }
    var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, accountInfo)
      .replace(/{LOAD_PAGE}/g, req.session.page ? `<script>
        showPage("${req.session.page}");
        if(${req.session.currentGuild})
          toggleGuild("${req.session.currentGuild}");
        </script>` : '')
      .replace(/{ADMIN_FORMS}/g, adminForms)
      .replace(/{INVITE_LINK}/g, inviteLink)
      .replace(/{TOAST}/g, req.session.wasUpdated ? `<div id="toast">Guild ${req.session.wasUpdated} updated</div>` : '');
      req.session.wasUpdated = undefined;
      req.session.save(function(err){
        if (err) return next(err);
        return response.send(result);
      });
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
      var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
      var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, authentificationBlock(encodeURIComponent(req.session.state), getAuthUrl(fullUrl)))
        .replace(/{LOAD_PAGE}/g, req.session.page ? '<script>showPage("' + req.session.page + '")</script>' : '')
        .replace(/{ADMIN_FORMS}/g, 'Please connect with discord to manage the bot')
        .replace(/{TOAST}/g, '');
      return response.send(result);
    });
  });
});

app.post('/', async (req, res, next) => {
  //Check that the user is admin of the entered guild
  let guild = client.guilds.resolve(req.body.guild);
  let member;
  if(guild){
    member = await guild.members.fetch(req.session.user.id);
  }
  if(!member || !member.permissions.has(PermissionsBitField.Flags.ADMINISTRATOR)){
    return next(errorContext({name: 'missingPermissionException', message: 'Cannot fetch guild or session owner doesn\'t have admin permission on guild: '+(guild ? guild.name : req.body.guild)},'at app.post(/)'));
  }
  //Check that the form was created and sent by the same person
  if(req.body.salt === req.session.salt){
    try{
      await business.updateGuild(req.body);
    }catch(error){
      return next(errorContext(error, ' at app.post(/)'));
    }
  }
  req.session.wasUpdated = guild.name;
  req.session.currentGuild = guild.id;
  req.session.save(function (err) {
    if (err) {
      return next(errorContext(err, 'Could not save the session in the store')); //Return is used to stop execution and jump straight to the next error function
    }
  res.redirect('/');
  });
});

//Formatted error display
app.use((error, req, res, next) => {
  //Load the authentification URL parameter
  let data = fs.readFileSync(root + index, 'utf8');
  if (!data)
    return next(errorContext(fileReadError, 'Unable to find index file'));
  result = data.replace(/{ERROR_BLOCK}/g, errorDisplay(error) + '\n<script>showError();</script>')
  .replace(/{AUTHENTIFICATION_BLOCK}/g, '')
  .replace(/{LOAD_PAGE}/g, '')
  .replace(/{TOAST}/g, '');
  if(!res.headersSent){
    errorLog(error);
    return res.status(500).send(result);
  }else{
    return next(error);
  }
});

//Unformatted error display
app.use(function (err, req, res, next) {
  errorLog(err);
  if(!res.headersSent){
    res.status(500).send(errorDisplay(err));
  }else{
    console.error('Tried to send error despite already sent headers for error above');
  }
});

module.exports = {
  init: init
}
