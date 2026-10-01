import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync}from'node:child_process';import{parseEnv}from'node:util';
test('setup fills blank client fields without replacing the private vault key or configured client',()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-setup-'));const script=new URL('../scripts/configure-local.mjs',import.meta.url).pathname;
 try{const run=args=>spawnSync(process.execPath,[script,...args],{cwd:dir,encoding:'utf8'});
 assert.equal(run([]).status,0);const first=parseEnv(readFileSync(join(dir,'.env'),'utf8'));assert.ok(first.SPAMMISH_TOKEN_VAULT_KEY);
 const client=join(dir,'client.json');writeFileSync(client,JSON.stringify({web:{client_id:'123-fixture.apps.googleusercontent.com',client_secret:'synthetic-secret',redirect_uris:['http://127.0.0.1:8080/auth/callback']}}));
 const configured=run(['--web-client',client]);assert.equal(configured.status,0);assert.equal(configured.stdout.includes('synthetic-secret'),false);
 const second=parseEnv(readFileSync(join(dir,'.env'),'utf8'));assert.equal(second.SPAMMISH_TOKEN_VAULT_KEY,first.SPAMMISH_TOKEN_VAULT_KEY);assert.equal(second.GOOGLE_CLIENT_ID,'123-fixture.apps.googleusercontent.com');
 writeFileSync(client,JSON.stringify({web:{client_id:'other.apps.googleusercontent.com',client_secret:'replacement',redirect_uris:['http://127.0.0.1:8080/auth/callback']}}));assert.equal(run(['--web-client',client]).status,0);assert.equal(parseEnv(readFileSync(join(dir,'.env'),'utf8')).GOOGLE_CLIENT_ID,second.GOOGLE_CLIENT_ID);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('doctor truthfully reports missing configuration without exposing private values',()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-doctor-'));try{
 writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.4.0'}));writeFileSync(join(dir,'.env'),'PORT=1\nGOOGLE_CLIENT_SECRET=never-print-me\n');
 const result=spawnSync(process.execPath,[new URL('../scripts/doctor.mjs',import.meta.url).pathname,'--json'],{cwd:dir,encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stdout.includes('never-print-me'),false);const report=JSON.parse(result.stdout);assert.equal(report.SETUP_COMPLETE,false);assert.equal(report.GMAIL_AUTHORIZED,false);assert.equal(report.SPAMMISH_RUNNING,false);assert.ok(report.blockers.length);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
