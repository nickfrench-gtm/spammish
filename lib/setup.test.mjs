import {createServer} from 'node:http';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,rmSync,chmodSync,statSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync,spawn}from'node:child_process';import{parseEnv}from'node:util';
test('setup fills blank client fields without replacing the private vault key or configured client',()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-setup-'));const script=new URL('../scripts/configure-local.mjs',import.meta.url).pathname;
 try{const run=args=>spawnSync(process.execPath,[script,...args],{cwd:dir,encoding:'utf8'});
 assert.equal(run([]).status,0);const first=parseEnv(readFileSync(join(dir,'.env'),'utf8'));assert.ok(first.SPAMMISH_TOKEN_VAULT_KEY);
 const client=join(dir,'client.json');writeFileSync(client,JSON.stringify({web:{client_id:'123-fixture.apps.googleusercontent.com',client_secret:'synthetic-secret',redirect_uris:['http://127.0.0.1:8080/auth/callback']}}));
 chmodSync(join(dir,'.env'),0o644);
 const configured=run(['--web-client',client]);assert.equal(statSync(join(dir,'.env')).mode&0o777,0o600);assert.equal(configured.status,0);assert.equal(configured.stdout.includes('synthetic-secret'),false);
 const second=parseEnv(readFileSync(join(dir,'.env'),'utf8'));assert.equal(second.SPAMMISH_TOKEN_VAULT_KEY,first.SPAMMISH_TOKEN_VAULT_KEY);assert.equal(second.GOOGLE_CLIENT_ID,'123-fixture.apps.googleusercontent.com');
 writeFileSync(client,JSON.stringify({web:{client_id:'other.apps.googleusercontent.com',client_secret:'replacement',redirect_uris:['http://127.0.0.1:8080/auth/callback']}}));assert.equal(run(['--web-client',client]).status,0);assert.equal(parseEnv(readFileSync(join(dir,'.env'),'utf8')).GOOGLE_CLIENT_ID,second.GOOGLE_CLIENT_ID);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('doctor truthfully reports missing configuration without exposing private values',()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-doctor-'));try{
 writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.4.0'}));writeFileSync(join(dir,'.env'),'PORT=1\nGOOGLE_CLIENT_SECRET=never-print-me\n');
 const result=spawnSync(process.execPath,[new URL('../scripts/doctor.mjs',import.meta.url).pathname,'--json'],{cwd:dir,encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stdout.includes('never-print-me'),false);const report=JSON.parse(result.stdout);assert.equal(report.SPAMMISH_READY,false);assert.equal(report.SETUP_COMPLETE,false);assert.equal(report.GMAIL_AUTHORIZED,false);assert.equal(report.SPAMMISH_RUNNING,false);assert.ok(report.blockers.length);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('doctor ready status requires private configuration, verified authorization and an enabled live worker',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-doctor-ready-'));
 let health={application:'spammish',version:'0.4.0',connectedAccounts:1,gmailAuthorized:true,workerActive:true,reconnectRequired:false,lastSuccessfulCheck:Date.now()};
 const server=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(health));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const script=new URL('../scripts/doctor.mjs',import.meta.url).pathname,port=server.address().port;
 const run=(args=['--json'])=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script,...args],{cwd:dir,env:{...process.env,PORT:String(port),GOOGLE_REDIRECT_URI:`http://127.0.0.1:${port}/auth/callback`,GOOGLE_CLIENT_ID:'123-fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-secret'},stdio:['ignore','pipe','pipe']});let stdout='';child.stdout.on('data',chunk=>stdout+=chunk);child.on('error',reject);child.on('exit',status=>resolve({status,stdout}));});
 try{
  writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.4.0'}));
  writeFileSync(join(dir,'.env'),'SPAMMISH_TOKEN_VAULT_KEY='+Buffer.alloc(32,7).toString('base64url')+'\n',{mode:0o600});
  const ready=await run();assert.equal(ready.status,0);assert.equal(JSON.parse(ready.stdout).SPAMMISH_READY,true);assert.equal(ready.stdout.includes('synthetic-secret'),false);
  const human=await run([]);assert.match(human.stdout,/SPAMMISH READY\s*$/);
  health.workerActive=false;const paused=await run();assert.equal(paused.status,1);assert.equal(JSON.parse(paused.stdout).SPAMMISH_READY,false);
  health.workerActive=true;health.gmailAuthorized=false;const unverified=await run([]);assert.equal(unverified.status,1);assert.match(unverified.stdout,/SPAMMISH NOT READY\s*$/);
  health.gmailAuthorized=true;chmodSync(join(dir,'.env'),0o644);const exposed=await run();assert.equal(exposed.status,1);assert.equal(JSON.parse(exposed.stdout).FILESYSTEM_READY,false);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
