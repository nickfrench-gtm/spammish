import { existsSync, readFileSync, statSync, accessSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { installedClient } from '../lib/desktop-oauth.mjs';
const desktop=process.argv.includes('--desktop'), json=process.argv.includes('--json');
const version=process.versions.node.split('.').map(Number);
const supported=version[0]>22||version[0]===22&&version[1]>=13;
const report={RUNTIME_SUPPORTED:supported,SETUP_COMPLETE:false,GMAIL_CONNECTION_STORED:false,GMAIL_AUTHORIZED:false,SPAMMISH_RUNNING:false,BACKGROUND_WORKER_ACTIVE:false,blockers:[]};
if(!supported)report.blockers.push('Install Node 22.13 or newer; Node 24 is recommended.');
if(desktop){
 let valid=false;try{installedClient(JSON.parse(readFileSync('desktop/oauth-client.json','utf8')));valid=true;}catch{}
 report.GOOGLE_CLIENT_CONFIGURED=valid;
 report.SETUP_COMPLETE=supported&&valid&&existsSync('node_modules/electron');
 if(!valid)report.blockers.push('Create your own Desktop app OAuth client and save its downloaded JSON as desktop/oauth-client.json.');
 if(!existsSync('node_modules/electron'))report.blockers.push('Run npm ci to install the desktop runtime.');
 report.blockers.push('Verify desktop running/authorization in its window: connected account, On, and a successful check. This command does not inspect OS-encrypted credentials or claim desktop authorization.');
}else{
 let env={};try{env=parseEnv(readFileSync('.env','utf8'));}catch{report.blockers.push('Run npm run setup to create private local configuration.');}
 const config={...env,...process.env};
 let filesystemReady=false;
 try{
  const privateConfig=process.platform==='win32'||(statSync('.env').mode&0o077)===0;
  let target=resolve(config.SPAMMISH_DATA_FILE||'./data/spammish.db');
  while(!existsSync(target)&&dirname(target)!==target)target=dirname(target);
  accessSync(target,constants.W_OK);
  filesystemReady=privateConfig;
  if(!privateConfig)report.blockers.push('Make .env private (chmod 600 .env), or run setup to secure it. Do not print its contents.');
 }catch{report.blockers.push('Create private configuration with setup and ensure the configured local state location is writable.');}
 report.FILESYSTEM_READY=filesystemReady;
 const key=Buffer.from(config.SPAMMISH_TOKEN_VAULT_KEY||'','base64url');
 const port=Number(config.PORT||8080);
 let redirectOK=false;try{const u=new URL(config.GOOGLE_REDIRECT_URI||`http://127.0.0.1:${port}/auth/callback`);redirectOK=u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&u.port===String(port)&&u.pathname==='/auth/callback'&&!u.search&&!u.hash;}catch{}
 const valid=/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(config.GOOGLE_CLIENT_ID||'')&&Boolean(config.GOOGLE_CLIENT_SECRET)&&redirectOK;
 report.GOOGLE_CLIENT_CONFIGURED=valid;report.VAULT_CONFIGURED=key.length===32;
 const portValid=Number.isInteger(port)&&port>0&&port<=65535;
 report.SETUP_COMPLETE=supported&&valid&&report.VAULT_CONFIGURED&&filesystemReady&&portValid;
 if(!portValid)report.blockers.push('Choose a port from 1 to 65535 and its matching Google redirect.');
 if(!valid)report.blockers.push('Configure your own Web application OAuth client and matching loopback redirect. See docs/agent-install.md.');
 if(key.length!==32)report.blockers.push('The local vault key must decode to 32 bytes. Preserve any existing key; changing it loses access to saved state.');
 if(Number.isInteger(port)&&port>0&&port<=65535){try{
  const response=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('unavailable');const h=await response.json();
  if(h.application!=='spammish'||h.version!==JSON.parse(readFileSync('package.json','utf8')).version)throw new Error('wrong_runtime');
  report.SPAMMISH_RUNNING=true;report.GMAIL_CONNECTION_STORED=h.connectedAccounts>0;report.GMAIL_AUTHORIZED=h.gmailAuthorized===true;report.BACKGROUND_WORKER_ACTIVE=h.workerActive===true;report.RECONNECT_REQUIRED=h.reconnectRequired===true;report.LAST_SUCCESSFUL_CHECK=h.lastSuccessfulCheck||null;
 }catch{report.blockers.push('Start this source version with npm start; keep it running. If the port is occupied, choose another port and matching Google redirect.');}}
 if(report.SPAMMISH_RUNNING&&!report.GMAIL_CONNECTION_STORED)report.blockers.push('Open the local page and let the human complete Google OAuth consent. No password or MFA code belongs in Spammish.');
 if(report.GMAIL_CONNECTION_STORED&&!report.GMAIL_AUTHORIZED)report.blockers.push('Authorization has not been verified in a recent successful check. Check Pause/reconnect/provider errors in the local page.');
 if(report.GMAIL_CONNECTION_STORED&&!report.BACKGROUND_WORKER_ACTIVE)report.blockers.push('Turn on an account in the local page to enable filtering.');
}
report.SPAMMISH_READY=report.SETUP_COMPLETE&&report.SPAMMISH_RUNNING&&report.GMAIL_AUTHORIZED&&report.BACKGROUND_WORKER_ACTIVE;
if(json)console.log(JSON.stringify(report,null,2));else{for(const [name,value]of Object.entries(report))if(name!=='blockers')console.log(`${name}: ${value}`);for(const message of report.blockers)console.log(`NEXT: ${message}`);}
if(!json)console.log(report.SPAMMISH_READY?'SPAMMISH READY':'SPAMMISH NOT READY');
process.exitCode=report.SPAMMISH_READY?0:1;
