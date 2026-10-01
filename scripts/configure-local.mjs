import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const args=process.argv.slice(2),index=args.indexOf('--web-client');
if(existsSync('.env')){console.log('Existing .env retained. Edit it to change the Google client.');process.exit(0);}
let clientId='',clientSecret='',redirectUri='http://127.0.0.1:8080/auth/callback',port='8080';
if(index!==-1){
 if(!args[index+1])throw new Error('Supply the downloaded Google web-client JSON path.');
 const web=JSON.parse(readFileSync(args[index+1],'utf8')).web;
 if(!web?.client_id||!web.client_secret)throw new Error('A Google Web application OAuth client is required for the headless server.');
 const redirect=web.redirect_uris?.find(value=>{try{const u=new URL(value);return u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname==='/auth/callback'&&!u.search&&!u.hash&&u.port;}catch{return false;}});
 if(!redirect)throw new Error('Configure a loopback callback such as http://127.0.0.1:8080/auth/callback in Google Cloud first.');
 clientId=web.client_id;clientSecret=web.client_secret;redirectUri=redirect;port=new URL(redirect).port;
}
for(const value of [clientId,clientSecret,redirectUri])if(/[\r\n]/.test(value))throw new Error('Invalid Google configuration.');
const content=`NODE_ENV=development\nPORT=${port}\nSPAMMISH_DATA_FILE=./data/spammish.db\nSPAMMISH_TOKEN_VAULT_KEY=${randomBytes(32).toString('base64url')}\nGOOGLE_CLIENT_ID=${JSON.stringify(clientId)}\nGOOGLE_CLIENT_SECRET=${JSON.stringify(clientSecret)}\nGOOGLE_REDIRECT_URI=${JSON.stringify(redirectUri)}\n`;
writeFileSync('.env',content,{flag:'wx',mode:0o600});
console.log(clientId?'Local .env created with your Google client and a private encryption key. Run npm start.':'Local .env created with a private encryption key. Add your Google web client before connecting Gmail.');
