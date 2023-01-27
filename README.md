# MAGES.
This is a Discord bot working with discord.js.
The goal is to provide tools to help with administration on discord server.

## How to run the bot
Set the environment variable:
* OWNER: Discord snowflake of the owner of this instance of MAGES.
* TOKEN: The token of the bot
* DATABASE_STRING: Connection string for the postgresql database
* SSL_DIRECTORY: Directory where MAGES. SSL certificates are stored
* WEBPORT: Port for the local webserver (default 80)
* oAuth2
 * APPLICATION_ID: ID of your discord app for 
 * APPLICATION_SECRET: Secret of your discord app for 
 * PUBLIC_KEY: Public key of your discord app for 
 * PUBLIC_ADDRESS: Public address with port for the local webserver
 * AUTH_URL: oAuth2 URL to authorize the app, scopes identify and guilds
* COOKIE_SECRET: Secret string to authentify cookies
Run the command `npm run start`

## SSL Configuration
The following files must be present in the ssl directory:
* pg_root.cer: Certificate authority certificate
* pg_client.key: Client side private key
* pg_client.cer: Client side certificate