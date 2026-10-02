import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtimeProof } from './runtime-proof.mjs';
import { randomBytes } from 'node:crypto';
test('clean loopback startup is usable and rejects cross-site actions and DNS rebinding',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-server-'));
 const vaultKey=randomBytes(32).toString('base64url');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',SPAMMISH_DATA_FILE:join(dir,'state.db'),SPAMMISH_TOKEN_VAULT_KEY:vaultKey,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
 let base='';
 try{
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('startup_timeout')),10000);child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('startup_failed'));});});
  const response=await fetch(base);const html=await response.text();assert.equal(response.status,200);assert.match(html,/0 emails sent to The Abyss/);assert.match(html,/Configure your Google/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const health=await (await fetch(base+'/health')).json();assert.equal(health.application,'spammish');assert.equal(health.gmailAuthorized,false);assert.equal(health.workerActive,false);assert.equal(health.connectedAccounts,0);assert.equal(JSON.stringify(health).includes('refresh'),false);
  const challenge=randomBytes(32).toString('hex');
  const challenged=await (await fetch(base+'/health?challenge='+challenge)).json();
  assert.equal(challenged.runtimeProof,runtimeProof({...process.env,PORT:'0',SPAMMISH_DATA_FILE:join(dir,'state.db'),SPAMMISH_TOKEN_VAULT_KEY:vaultKey,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''},challenge,new URL('..',import.meta.url).pathname));
  assert.equal(JSON.stringify(challenged).includes(vaultKey),false);assert.equal(JSON.stringify(challenged).includes(dir),false);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const bad=await fetch(base+'/toggle',{method:'POST',headers:{cookie,origin:'https://evil.example'},body:'csrf=no'});assert.equal(bad.status,403);
  const csrf=await fetch(base+'/toggle',{method:'POST',headers:{cookie},body:'csrf=no'});assert.equal(csrf.status,403);
  const rebound=await new Promise((resolve,reject)=>{const req=request(base,{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(rebound,403);
  assert.equal((await fetch(base+'/data/state.db')).status,404);
 }finally{const exited=once(child,'exit');child.kill('SIGTERM');await exited;rmSync(dir,{recursive:true,force:true});}
});
