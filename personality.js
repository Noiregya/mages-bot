const tools = require('./tools');
const dao = require('./dao');

var hasSaidHelloRecently = [];

function reactToMessage(client, msg) {
    var reactedToPeriod = false;
    if (msg.content.toUpperCase().match(/(^|\s)MAGES(?!\.)/)) {
        if (msg.author.id === '187657519802482688') {
            if (msg.content.toUpperCase().match(/MAGES MAGES/)) {
                msg.channel.send(tools.randomReiReact()).catch(function(err){console.error(err);});
            } else if (Math.random()*100 < 26) {
                reactedToPeriod = true;
                sayWithDelay(" that's \"MAGES.\" with a period.", msg.channel).catch(err=>{});
            }
        }
    }else if (msg.content.match(/MAGES\./)) {
        dao.updateFriendliness(msg.author.id, msg.guild.id, 1).catch(function(err) {
            console.error(err);
        });
    }
    if ((msg.content.toUpperCase().includes('OWO') || msg.content.toUpperCase().includes('UWU')) && !reactedToPeriod) {
        dao.updateFriendliness(msg.author.id, msg.guild.id,-1).then(res =>{
            if (res > 0) {
                if (Math.random()*100 < 50) {
                    msg.react('604188896275988481').catch(err => {console.error(err);});
                }else{
                    sayWithDelay(tools.randomOWOreact(), msg.channel).catch(err => {console.error(err);});
                }
            }else if (res === 0) {
                sayWithDelay('I had enough of you.', msg.channel).catch(err=>(err));
            }
        });
    }
    if (msg.mentions.users.get(client.user.id)) {
        //MAGES. has been mentionned
        if (msg.content.toUpperCase().match(/(^|\s)(HOWDY|HELLO|HI|WHAT[']?S UP|GOOD MORNING|YO|HENLO|GOOD EVENING|GREETINGS|YAHALLO|HEY)/)) {
            if (hasSaidHelloRecently.includes(msg.author.id)) {
                //We just said hello
                msg.reply(' we just said hello...');
                dao.updateFriendliness(msg.author.id, msg.guild.id, -2).then(res=>{
                    if (res === -1 || res === 0) {
                        msg.channel.send('That\'s it, I\'m done.').catch(err=>(err));
                    }
                },err=>{console.error(err);});
            }else{
                dao.updateFriendliness(msg.author.id, msg.guild.id, 1).then(friendliness => {
                    msg.channel.send(tools.randomHelloReact(friendliness)).then(res=>{

                        hasSaidHelloRecently.push(msg.author.id);
                        let removeFromListFunction = userID => {
                            hasSaidHelloRecently = hasSaidHelloRecently.filter(currentUser => currentUser != userID);
                        };
                        setTimeout(removeFromListFunction.bind(null, msg.author.id), 36000000);
                        //ADD DELAY

                    },err=>{console.error(err);});
                }, err=>{
                    console.error(err);
                });
            }
        }
    }
}

async function sayWithDelay(textToSay, channel){
    setTimeout(function(){
        return channel.send(textToSay);
    }, textToSay.length * 150);
    let res = await channel.sendTyping();
    return res;
}

module.exports = {
    reactToMessage : reactToMessage,
    sayWithDelay: sayWithDelay
};