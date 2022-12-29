const fs = require('node:fs');
const express = require('express');
const { request } = require('undici');
const app = express();
const root = __dirname + '/www/';
const index = 'index.html';
const authentifiedPage = 'settings.html';
const port = process.env.WEBPORT || 80;
const publicAddress = process.env.PUBLIC_ADDRESS;
const clientId = process.env.APPLICATION_ID;
const clientSecret = process.env.APPLICATION_SECRET;
const authUrl = process.env.AUTH_URL;

const authentificationBlock = '<div id="info">Please log in before you continue</div>\n'+
'<a id="login" style="display: block;" href="'+authUrl+'">Identify Yourself</a>';

console.log(root);
fs.readdirSync(root).forEach(file => {
  if (file != authentifiedPage) {
    app.get('/' + file, (req, res) => {
      var options = {
        root: root
      };
      res.sendFile(file, options);
    })
  }
});

//TODO: Implement CRSF attack protection https://discordjs.guide/oauth2/#implicit-grant-flow
//TODO: Maintain sessions
//TODO: Refresh token
app.get('/' + authentifiedPage, async ({ query }, response) => {
  const { code } = query;
  let userResult;
  let user;
  if (code) {
    try {
      const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: publicAddress + authentifiedPage,
          scope: 'identify',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
      });

      const oauthData = await tokenResponseData.body.json();
      userResult = await request('https://discord.com/api/users/@me', {
        headers: {
          authorization: `${oauthData.token_type} ${oauthData.access_token}`,
        },
      });
      user = await userResult.body.json();
    } catch (error) {
      // NOTE: An unauthorized token will not throw an error
      // tokenResponseData.statusCode will be 401
      console.error(error);
    }
  }

  //Load the authentification URL parameter
  fs.readFile(root+authentifiedPage, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }

    if(user && user.id){
      var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, 'Welcome '+user.username+'#'+user.discriminator);
    }else{
      var result = data.replace(/{AUTHENTIFICATION_BLOCK}/g, authentificationBlock);
    }
    return response.send(result);
  });
});

app.listen(port, () => {
  console.log(`The website is running on port ${port}`)
})
