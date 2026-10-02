import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

test('website collector is disabled by default and enabled receipts leave existing website/waitlist working', async () => {
 for (const enabled of [false,true]) {
  const dir=await mkdtemp(join(tmpdir(),'spammish-site-metrics-'));
  const reservation=createServer(); await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
  const port=reservation.address().port; await new Promise(r=>reservation.close(r));
  const origin=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['marketing/server.mjs'],{env:{...process.env,PORT:String(port),PUBLIC_ORIGIN:origin,WAITLIST_DATA_DIR:dir,SPAMMISH_METRICS_ENABLED:enabled?'yes':'no'},stdio:'ignore'});
  try {
   let ready=false; for(let i=0;i<50;i++){try{ready=(await fetch(origin+'/healthz')).ok;if(ready)break;}catch{} await new Promise(r=>setTimeout(r,50));}
   assert.equal(ready,true); assert.equal((await fetch(origin)).status,200);
   const payload={install_id:'12345678-1234-4234-8234-123456789abc',event:'first_abyss',app_version:'0.4.3',platform:'darwin'};
   const send=value=>fetch(origin+'/api/milestones',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
   assert.equal((await send(payload)).status,enabled?204:404);
   if(enabled){
    assert.equal((await send(payload)).status,204);
    assert.equal((await send({...payload,subject:'must not store'})).status,400);
    const rows=JSON.parse(await readFile(join(dir,'spammish-milestones.json'),'utf8')); assert.equal(rows.length,1); assert.deepEqual(Object.keys(rows[0]).sort(),['app_version','day','event','install_id','platform']);
   } else { await assert.rejects(readFile(join(dir,'spammish-milestones.json')), {code:'ENOENT'}); }
   assert.equal((await fetch(origin+'/spammish-milestones.json')).status,404);
   assert.equal((await fetch(origin+'/api/waitlist',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.com',consent:true})})).status,200);
  } finally {child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
 }
});
