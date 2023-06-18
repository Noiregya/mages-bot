# MAGES.
This is a Discord bot working with discord.js.
The goal is to provide tools to help with administration on discord server. The main feature is the role picker system called "nations" which allow to jazz up picked nations a lot more, show your support for something with a specific role etc.

The bot is configured through a webpage accessible by requesting the root of the host running the bot with the provided port. Connection is made using oAuth2, that connection allows the bot to confirm which guilds you have administration rights in before it lets you change configurations.

## Features
### Webpage configuration
No pesky commands! A web UI is available for server administration. You will be able to connect securely and manage any servers MAGES. has joined from there.

### Nation picker
Role picker messages can be generated, pick which channel will be your info channel then add any number of roles (called nations) for users to choose from! For every nation you are able to configure the name, a short description, a thumbnail, and the discord role to which it must be attached. Two types of nations exist:
* Open nations, members can pick any number of those.
* Exclusive nations, members may only join one at once, when they join a new nation, they are removed from the previous one. A summary will keep track of each exclusive nation's popularity!

### Welcome member
MAGES. can welcome user with fun flavour messages.

### Notifications
MAGES. will send messages to moderators who opt in when members join, leave, and when the raid protection is enabled. Opting in and out is done with the /whitelist command.

### Mute and Raid protection
* A mute role can be given to or removed from members easily by mods simply by right clicking on a member and going to "apps">"toggle mute". 
* Members whose account is too young will alwyas be muted on join. 
* Members whose naime contain URLs will be banned on sight.
* A raid protection can be enabled where every member will be muted on join and mods will be notified so they can decide what to do.

### Pinboard
Right click on a message and choose "vote to pin" to begin a vote, if enough people vote, the post will be pinned.

### Activity monitor
Inactive members will be kicked off nations afer a delay. Coming soon!

## How to run the bot
Create the bot on discord developper portal:
* Go to oAuth2 and add Redirects for the {myBotUrl}/login endpoint 
Prepare the database:
* Install postgresql and import the provided sql script \[coming soon\]
Set the environment variable:
* OWNER: Discord snowflake of the owner of this instance of MAGES.
* TOKEN: The token of the bot
* DATABASE_STRING: Connection string for the postgresql database (postgres://\[user\]@\[domain\]:\[port\]/\[database\])
* ssl: SSL certificates are used for database secured authentification and for the webpage
 * SSL_KEY: SSL Client Private Key path
 * SSL_CERT: SSL Client Certificate path
 * CA_CERT: Certificate Authority path
* WEBPORT: Port for the local webserver (default 80)
* oAuth2
 * APPLICATION_ID: ID of your discord app
 * APPLICATION_SECRET: Secret of your discord app
 * PUBLIC_KEY: Public key of your discord app
* COOKIE_SECRET: Secret string to authentify cookies

Run the command `npm run start`

## SSL Configuration
The following files must be present in the ssl directory:
* root.cer: Certificate authority certificate
* client.key: Client side private key
* client.cer: Client side certificate
Note: You must allow this certificate to log as your database user.

## Credits
[All art made by Tacoma](https://www.nimbaterra.com/)