# MAGES.
This is a Discord bot working with discord.js.
The goal is to provide tools to help with administration on discord server. The main feature is the role picker system called "nations" which allow to jazz up picked nations a lot more, show your support for something with a specific role etc.

The bot is configured through a webpage accessible by requesting the root of the host running the bot with the provided port. Connection is made using oAuth2, that connection allows the bot to confirm which guilds you have administration rights in before it lets you change configurations.

## How to run the bot
Create the bot on discord developper portal:
* Go to oAuth2 and add Redirects for the {myBotUrl}/login endpoint 
Prepare the database:
* Install postgresql and import the provided sql script \[coming soon\]
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
* COOKIE_SECRET: Secret string to authentify cookies
Run the command `npm run start`

## SSL Configuration
The following files must be present in the ssl directory:
* postgresql database
 * pg_root.cer: Certificate authority certificate
 * pg_client.key: Client side private key
 * pg_client.cer: Client side certificate