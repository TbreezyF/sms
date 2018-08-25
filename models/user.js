const AWS = require('aws-sdk');

AWS.config.update({
    region: "ca-central-1",
    endpoint: "https://dynamodb.ca-central-1.amazonaws.com"
});

const db = new AWS.DynamoDB.DocumentClient({
    convertEmptyValues: true
});

module.exports = {
    fetch: async function(username, cb){
        let query = {
            TableName: 'Mailbox-Users',
            Key: {
                username: username
            }
        };

        let user = await db.get(query).promise();

        if(user.Item){
            let response = {
                username: user.Item.username,
                email: user.Item.email
            };
            if(cb){
                cb(null,response);
            }
            else{
                return response;
            }
        }
        else{
            if(cb){
                cb(new Error('BAD REQUEST: User not found in database.'));
            }else{
                return new Error('BAD REQUEST: User not found in database.');
            }
        }
    }
};