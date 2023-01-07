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

app.use(session({
  secret: cookieSecret,
  resave: false,
  saveUninitialized: true,
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
  let rank = err.business.push(message) - 1; //Adds the message to the array and returns the index of that element
  //Information useful for debugging but that we don't want to show the end user
  if (secret) {
    if (!err.secret) err.secret = [];
    err.secret[rank] = secret; //Secret placed at the same index as the business message
  }
  return err;
}

function errorDisplay(err) {
  let string = 'An error occured: ' + err.name + ' : ' + err.message + '\n<table>';
  for (i = 0; i < err.business.length; i++) {
    string += '<tr><td>' + err.business[i] + '</td></tr>\n';
  }
  return string + '</table>';
}

function errorLog(err) {
  let string = 'An error occured: ' + err.name + ' : ' + err.message + '\n';
  for (i = 0; i < err.business.length; i++) {
    string += err.name + ' : ' + err.business[i];
    if(err.secret[i]) string += ' ' + err.secret[i];
    string += '\n'
  }
  console.error(string);
}

//Connect to discord by getting the token then the user object
async function connect(code, state) {
  let user;
  if (code) {
    let token = await getDiscordToken(code).catch(err => {
      throw errorContext(err, 'Unable to get discord token with code ' + code);
    });
    if (token) {
      return await getDiscordUser(token).catch(err => {
        throw errorContext(err, 'Unable to get discord user with token', token); //Token is only going to be visible in the logs
      });
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
  connect(req.query.code,).then(function (user) {
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
      scope: 'identify'
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

//TODO: Refresh token?

//Page for authentified user
app.get('/', isAuthenticated, async (req, response, next) => {
  let user = req.session.user;
  let pageContent = 'Welcome ' + user.username + '#' + user.discriminator + '<div><a href="/logout">log out</a></div>\n';
  console.log('page: '+req.session.page);
  if(req.session.page) pageContent+= '<script>showPage("' + req.session.page + '");</script>\n';
  //Load the authentification URL parameter
  fs.readFile(root + index, 'utf8', function (fileReadError, data) {
    if (fileReadError) {
      return next(errorContext(fileReadError));
    }
    var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, pageContent);
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
      var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, authentificationBlock(encodeURIComponent(req.session.state)));
      return response.send(result);
    });
  });
});

//Formatted error display
app.use(async (error, req, response, next) => {
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
      result = data.replace(/{ERROR_BLOCK}/g, errorDisplay(error) + '\n<script>showError();</script>');
      return response.send(result);
    });
  });
});

//Unformatted error display
app.use(function (err, req, res, next) {
  errorLog(err);
  res.status(500).send(errorDisplay(err));
});

app.listen(port, () => {
  console.log(`The website is running on port ${port}`)
})
