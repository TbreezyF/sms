'use strict';

require('dotenv').config();
const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const user = require('./models/user.js');
const mta = require('./transferAgent.js');
const util = require('util');

const SERVER_PORT = process.env.PORT;
const SERVER_HOST = false;

// Setup server
const server = new SMTPServer({
    // log to console
    logger: true,

    // not required but nice-to-have
    banner: 'Sproft Media mail server 1.1',

    // disable STARTTLS to allow authentication in clear text mode
    //disabledCommands: ['STARTTLS'],

    // By default only PLAIN and LOGIN are enabled
    authMethods: ['PLAIN', 'LOGIN'],

    //Make Authentication Optional
    authOptional: true,

    // Accept messages up to 10 MB
    size: 10 * 1024 * 1024,

    // allow overriding connection properties. Only makes sense behind proxy
    useXClient: true,

    hidePIPELINING: true,

    // use logging of proxied client data. Only makes sense behind proxy
    useXForward: true,

    // Setup authentication
    // Allow only users with username 'testuser' and password 'testpass'
    onAuth(auth, session, callback) {
        let username = process.env.SERVER_USER;
        let password = process.env.SERVER_PASS;

        // check username and password
        if (
            auth.username === username &&
            (auth.method === 'CRAM-MD5' ?
                auth.validatePassword(password) // if cram-md5, validate challenge response
                :
                auth.password === password) // for other methods match plaintext passwords
        ) {
            return callback(null, {
                user: session.id // value could be an user id, or an user object etc. This value can be accessed from session.user afterwards
            });
        }

        return callback(new Error('Authentication failed'));
    },

    // Validate MAIL FROM envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onMailFrom(address, session, callback) {
        if (/^spam/i.test(address.address)) {
            return callback(new Error('Not accepted'));
        }
        callback();
    },

    // Validate RCPT TO envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onRcptTo(address, session, callback) {
        if(address.address.toString().includes('@sproft.com')){
            try{
                if(verifiedUser()){
                    return callback();
                }
                else{
                    return callback(new Error(`${address.address} is not allowed to receive mail on this server.`)); 
                }
                async function verifiedUser(){
                    await user.fetch(await getSproftUser(address.address));
                    if(user.username){
                        return true;
                    }
                    else{
                        return false;
                    }
                }
            }
            catch(error){
                return callback(new Error(`${address.address} is not allowed to receive mail on this server.`));  
            }
        }
        else{
            return callback();
        }
    },
    // 
    // Handle message stream
    onData(stream, session, callback) {
        simpleParser(stream, async (err, parsed) => {
            if(err){
               console.log('ERROR: Cannot process incoming message.');
            }
            else{
                let email_headers = {};
                let sender = parsed.from.text.toString();
                let senderDomain = sender.substring(sender.indexOf('@') + 1, sender.length);
                let date = new Date();

                email_headers.from = parsed.from.text;
                email_headers.to =  parsed.to.text;
                email_headers.subject = parsed.subject;
                email_headers.replyTo = parsed.replyTo.text;
                email_headers.date = {
                    hours: date.getHours(),
                    minutes: date.getMinutes(),
                    day: date.getDay(),
                    month: date.getMonth(),
                    year: date.getFullYear(),
                    seconds: date.getSeconds(),
                    utcDate: date.getUTCDate()
                };
                email_headers.message_id = parsed.messageId;
                email_headers.mime_version = 1.0;
                email_headers.dkim = parsed.dkim || false;
                email_headers.received = `Received: from [${parsed.from.text}] by ` +
                `${senderDomain} with ESMTPS id ${parsed.messageId}` +
                ` (version=TLSv1/SSLv3 cipher=OTHER); ${new Date()}`;


                let  message = {
                    from: parsed.from.text,
                    to: parsed.to.text,
                    cc: parsed.cc,
                    subject: parsed.subject,
                    date: email_headers.date,
                    replyTo: parsed.replyTo.text,
                    text: parsed.text,
                    html: parsed.textAsHtml,
                    attachments: parsed.attachments,
                    headers: email_headers
                }

                if(message.cc === ''){
                    delete message.cc;
                }


                console.log('\nDATA received and Queued.');

                let recipients = await mta.parseRecipients(parsed.to.text);

                let inBound = [];

                recipients.forEach(element => {
                    if(element.toString().includes('@sproft.com')){
                        inBound.push(element);
                    }
                });
                console.log('\nInbound Mail: ', inBound);

                //handleInbound
                if(inBound.length > 0){
                    inBound.forEach(async(element) => {
                        let username = await getSproftUser(element);
                        try{
                            await mta.handleSproftInbound(username, message);
                        }
                        catch(error){
                            console.log('Invalid recipient on Sproft Mail server.');
                        }
                    });
                }
            }

        });

        stream.on('end', () => {
            console.log('\n');
            let err;
            if (stream.sizeExceeded) {
                err = new Error('Error: message exceeds fixed maximum message size 10 MB');
                err.responseCode = 552;
                return callback(err);
            }
            callback(null, ' - Message queued'); // accept the message once the stream is ended
        });
    }
});

async function getSproftUser(email){
    let username;
    username = email.toString().substring(0, email.toString().indexOf('@'));
    return username;
}


server.on('error', err => {
    console.log('Error occurred on ' + new Date());
    console.log(err);
});

// start listening
server.listen(SERVER_PORT, SERVER_HOST);