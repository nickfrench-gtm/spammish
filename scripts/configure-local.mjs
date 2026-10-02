import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
const args=process.argv.slice(2),index=args.indexOf('--web-client');
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
if(existsSync('.env')){
 chmodSync('.env',0o600);
 const original=readFileSync('.env','utf8'),current=parseEnv(original);
 if(!clientId||current.GOOGLE_CLIENT_ID||current.GOOGLE_CLIENT_SECRET){console.log('Existing .env retained. Configured clients are never overwritten by setup.');process.exit(0);}
 // Fill a fresh template while preserving the vault key and all unrelated settings.
 let updated=original;
 for(const [key,value] of Object.entries({GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret,GOOGLE_REDIRECT_URI:redirectUri,PORT:port})){
  const line=`${key}=${JSON.stringify(value)}`,pattern=new RegExp(`^${key}=.*$`,'m');
  updated=pattern.test(updated)?updated.replace(pattern,()=>line):`${updated.trimEnd()}\n${line}\n`;
 }
 writeFileSync('.env',updated,{mode:0o600});console.log('Google client added to the existing template. Vault key preserved. Run npm run doctor.');process.exit(0);
}
const content=`NODE_ENV=development\nPORT=${port}\nSPAMMISH_DATA_FILE=./data/spammish.db\nSPAMMISH_TOKEN_VAULT_KEY=${randomBytes(32).toString('base64url')}\nGOOGLE_CLIENT_ID=${JSON.stringify(clientId)}\nGOOGLE_CLIENT_SECRET=${JSON.stringify(clientSecret)}\nGOOGLE_REDIRECT_URI=${JSON.stringify(redirectUri)}\n`;
writeFileSync('.env',content,{flag:'wx',mode:0o600});
console.log(clientId?'Local .env created with your Google client and a private encryption key. Run npm start.':'Local .env created with a private encryption key. Add your Google web client before connecting Gmail.');
