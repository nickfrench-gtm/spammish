import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

test('waitlist persists consent, deduplicates, validates and fails visibly at API boundary', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'spammish-waitlist-test-'));
 const file = join(dir,'spammish-waitlist.jsonl');
 const legacy = {email:'legacy@example.com',consent:'cloud-launch-updates-v1'};
 await writeFile(file,JSON.stringify(legacy)+'\n',{mode:0o600});
 const reservation=createServer(); await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
 const port=reservation.address().port; await new Promise(r=>reservation.close(r));
 const origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['marketing/server.mjs'],{env:{...process.env,PORT:String(port),PUBLIC_ORIGIN:origin,WAITLIST_DATA_DIR:dir},stdio:'ignore'});
 try {
  let ready=false;
  for(let i=0;i<50;i++){try{ready=(await fetch(origin+'/healthz')).ok;if(ready)break;}catch{} await new Promise(r=>setTimeout(r,50));}
  assert.equal(ready,true);
  const submit=(email,consent=true,from=origin)=>fetch(origin+'/api/waitlist',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({email,consent})});
  assert.equal((await submit('invalid')).status,400);
  assert.equal((await submit('test@example.com',false)).status,400);
  assert.equal((await submit('test@example.com',true,'http://wrong.example')).status,403);
  assert.equal((await submit('test@example.com')).status,200);
  assert.equal((await submit('test@example.com')).status,200);
  let rows=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2); assert.deepEqual(rows[0],legacy);
  assert.equal(rows[1].consent,'easier-experience-availability-v2');
  // A genuine write failure cannot return fake success or append a record.
  if(process.platform!=='win32'&&process.getuid?.()!==0){
   await chmod(file,0o400);
   const failure=await submit('failure@example.com');assert.equal(failure.status,503);
   assert.match((await failure.json()).error,/could not save/i);
   rows=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(rows.length,2);
   await chmod(file,0o600);
  }
 } finally {child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await chmod(file,0o600);await rm(dir,{recursive:true,force:true});}
});
