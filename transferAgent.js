const mailbox = require('./models/mailbox.js');
const mta_instance = require('sendmail');
const fs = require('fs');

module.exports = {
    handleSproftInbound: async function(username, message, cb){
        //verifyUsername
        //TODO: Filter message for Spam, verify sender (DKIM, SPF, DMARC)
        if(message && message instanceof Object){
            try{
                let data = {
                    mode: 1,
                    message: message
                }

                let user = {
                    username: username
                }
                await mailbox.add(user, data);
                if(cb){
                    cb();
                }
                else{
                    return;
                }
            }
            catch(error){
                if(cb){
                    cb(new Error('Unable to receive incoming mail.'));
                }
                else{
                    return new Error('Unable to receive incoming mail.');
                }
            }
        }
        else{
            if(cb){
                cb(new Error('Cannot find/verify message object.'));
            }
            else{
                return new Error('Cannot find/verify message object.');
            }
        }
    },
    parseRecipients: async function(list, cb){
        let recipients;
        if(list){
            list = list.toString().replace(/\s+/g, '');
            recipients = list.split(',');
            if(cb){
                cb(null, recipients);
            }
            else{
                return recipients;
            }
        }
        else{
            if(cb){
                cb(new Error('CONTENT ERROR: List not provided.'));
            }
            else{
                return new Error('CONTENT ERROR: List not provided.');
            }
        }
    }
} //END Exported module

async function checkSpam(){

}

async function checkVirus(){

}