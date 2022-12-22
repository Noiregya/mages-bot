const Token = process.env.TOKEN;
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'not set';
const axios = require('axios');
const express = require('express');
const port = 8999;
const { InteractionType, InteractionResponseType, verifyKeyMiddleware } = require('discord-interactions');

const app = express();

const discord_api = axios.create({
    baseURL: 'https://discord.com/api/',
    timeout: 3000,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Authorization",
        "Authorization": `Bot ${Token}`
    }
});

const COMMAND_TYPE = {
    SLASH: 1,
    USER: 2,
    MESSAGE: 3,
    AUTOCOMPLETE: 4
};

const OPTION_TYPE = {
    SUB_COMMAND: 1,
    SUB_COMMAND_GROUP: 2,
    TEXT: 3, //NOT SURE
    NUMBER: 4,//NOT SURE
    USER: 6,
    CHANNEL: 7,
    ROLE: 8
};

const globalCommands = [
    {
        "name": "yo",
        "description": "replies with Yo!",
        "type": COMMAND_TYPE.SLASH,
        "options": []
    },
    {
        "name": "toggle mute",
        "type": COMMAND_TYPE.USER,
        "options": []
    },
    {
        "name": "mute",
        "description": "Lists all currently muted users",
        "type": COMMAND_TYPE.SLASH,
        "options": []
    },
    {
        "name": "whitelist",
        "description": "Receive or stop receiving bot notifications",
        "type": COMMAND_TYPE.SLASH,
        "options": []
    },
    {
        "name": "register",
        "type": COMMAND_TYPE.USER,
        "options": []
    }
];

async function register(){
    try
    {
        // api docs - https://discord.com/developers/docs/interactions/application-commands#create-global-application-command
        let discord_response = await discord_api.put(
            `/applications/${process.env.APPLICATION_ID}/commands`,
            globalCommands
        );
        return 'Commands have been registered';
    }
    catch(e){
        let message = 'Error registering commands: ';
        if(e.response)
            message += e.response.data;
        else
            message += e;
        console.error(message);
        return message;           
    }
};

app.get('/', async (req,res) =>{ //Page web
    return res.send('Follow documentation ');
});

app.listen(port, () => {
    console.log(`MAGES. listening on port ${port}`);
});

module.exports = {
    register: register,
    COMMAND_TYPE: COMMAND_TYPE,
    OPTION_TYPE: OPTION_TYPE
};