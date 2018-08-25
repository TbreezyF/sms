const rsa = require('node-rsa');
const keyGen = new rsa({
    b: 1024
});

module.exports = {
    keys: function(){
        let key = keyGen.generateKeyPair(2048,65537);
        let keys = {
            privateKey: key.exportKey('pkcs8-private-pem'),
            publicKey: key.exportKey('pkcs8-public-pem')
        }
        return keys;
    }
}
