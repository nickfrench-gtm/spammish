import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Traction } from './traction.mjs';
import { TractionCollector } from './traction-collector.mjs';
import { DAY, EVENTS, validPayload } from './traction-schema.mjs';
const tick = () => new Promise(r => setImmediate(r));
async function settled(t) { for(let i=0;i<200;i++){await tick(); await t.writes; if(!t.running)return;} throw new Error('did_not_settle'); }
async function fixture(fn) { const dir=await mkdtemp(join(tmpdir(),'spammish-metrics-')); try { await fn(dir); } finally { await rm(dir,{recursive:true,force:true}); } }
const options = file => ({file,version:'0.4.3',platform:'darwin',suppressed:false});

test('pending/declined consent: no ID, payload, replay or network request',()=>fixture(async dir=>{
 let calls=0; const t=new Traction({...options(join(dir,'state')),fetcher:()=>{calls++;}});await t.ready;
 t.observe('app_started');t.observe('first_abyss');await settled(t);assert.equal(calls,0);assert.equal(t.state.id,undefined);
 await t.choose('off');t.observe('gmail_connected');await settled(t);assert.equal(calls,0);assert.equal(t.state.id,undefined);
 assert.equal(await t.choose('yes'),false);
}));

test('opt in creates random persistent ID; milestones deduplicate across restart and multiple accounts',()=>fixture(async dir=>{
 const sent=[]; const fetcher=async(_url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:true};};
 const file=join(dir,'state');const t=new Traction({...options(file),fetcher});await t.choose('on');await settled(t);
 t.observe('gmail_connected');t.observe('gmail_connected');t.observe('first_abyss');t.observe('first_abyss');await settled(t);
 assert.deepEqual(sent.map(p=>p.event),['app_started','gmail_connected','first_abyss']);assert.ok(sent.every(validPayload));
 const id=t.state.id;assert.equal((await stat(file)).mode&0o777,0o600);
 const restart=new Traction({...options(file),fetcher});await restart.ready;assert.equal(restart.state.id,id);
 restart.observe('app_started');restart.observe('first_abyss');await settled(restart);assert.equal(sent.length,3);
 const unrelated=new Traction({...options(join(dir,'other')),fetcher});await unrelated.choose('on');await settled(unrelated);assert.notEqual(unrelated.state.id,id);
}));

test('off aborts request, removes local ID/queue; explicit re-enable generates a new ID',()=>fixture(async dir=>{
 let aborted=false;const t=new Traction({...options(join(dir,'state')),fetcher:async(_u,{signal})=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true}))});
 await t.choose('on');await tick();const id=t.state.id;await t.choose('off');await settled(t);
 assert.equal(aborted,true);assert.equal(t.state.id,undefined);assert.deepEqual(t.state.queue,[]);
 assert.equal(JSON.parse(await readFile(t.file)).id,undefined);
 t.fetcher=async()=>({ok:true});t.retryAt=0;await t.choose('on');await settled(t);assert.notEqual(t.state.id,id);
}));

test('return milestones require elapsed consent time, first automatic move and successful worker activity',()=>fixture(async dir=>{
 let now=1000;const sent=[];const t=new Traction({...options(join(dir,'state')),now:()=>now,fetcher:async(_u,o)=>{sent.push(JSON.parse(o.body).event);return{ok:true};}});
 await t.choose('on');await settled(t);now+=30*DAY;t.observe('app_started');await settled(t);assert.equal(sent.includes('returned_30d'),false);
 t.observe('worker_active');await settled(t);assert.equal(sent.includes('returned_7d'),false);
 t.observe('first_abyss');t.observe('worker_active');await settled(t);
 assert.ok(sent.includes('returned_7d'));assert.ok(sent.includes('returned_30d'));
 t.observe('worker_active');t.observe('rescue_performed');t.observe('rescue_performed');await settled(t);
 assert.equal(sent.filter(e=>e==='returned_7d').length,1);assert.equal(sent.filter(e=>e==='rescue_performed').length,1);
}));

test('development/test/owner suppression defeats even persisted opt-in',()=>fixture(async dir=>{
 const file=join(dir,'state');const initial=new Traction({...options(file),fetcher:async()=>({ok:true})});await initial.choose('on');await settled(initial);
 let calls=0;const excluded=new Traction({...options(file),suppressed:true,fetcher:async()=>{calls++;}});await excluded.ready;
 assert.equal(await excluded.choose('on'),false);excluded.observe('first_abyss');await settled(excluded);assert.equal(calls,0);assert.equal(excluded.status().suppressed,true);
 const source=await readFile(new URL('../desktop/main.mjs',import.meta.url),'utf8');
 for(const flag of ['!app.isPackaged','NODE_TEST_CONTEXT','SPAMMISH_TELEMETRY_SUPPRESS','suppress-traction'])assert.ok(source.includes(flag));
}));

test('failed storage fails closed; malformed state never becomes consent',()=>fixture(async dir=>{
 const file=join(dir,'state');await writeFile(file,'{"choice":"on","id":"sender@example.com","seen":[],"queue":[]}');
 let calls=0;const t=new Traction({...options(file),fetcher:async()=>{calls++;}});await t.ready;t.observe('first_abyss');await settled(t);
 assert.equal(t.status().available,false);assert.equal(calls,0);assert.equal(await t.choose('on'),false);
}));

test('schema rejects every prohibited or arbitrary additional field and nested event data',()=>{
 const payload={install_id:randomUUID(),event:'app_started',app_version:'0.4.3',platform:'darwin'};assert.ok(validPayload(payload));
 for(const key of ['body','subject','sender','recipient','domain','messageId','threadId','token','credentials','account','score','evidence','path','timestamp','hardware'])assert.equal(Boolean(validPayload({...payload,[key]:'private'})),false);
 assert.equal(Boolean(validPayload({...payload,event:{email:'private'}})),false);
 assert.equal(Boolean(validPayload({...payload,event:'worker_active'})),false);
});

test('real loopback payload capture, deduplication, retention, rejection and reporting',()=>fixture(async dir=>{
 let now=Date.now();const collector=new TractionCollector({file:join(dir,'receipts'),enabled:true,now:()=>now});await collector.ready;
 const captured=[];const server=createServer(async(req,res)=>{
   const chunks=[];req.on('data',c=>chunks.push(c));
   if(!await collector.handle(req,res)){res.writeHead(404);res.end();}
   if(chunks.length)captured.push(Buffer.concat(chunks).toString());
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const endpoint=`http://127.0.0.1:${server.address().port}/api/milestones`;
 try {
   const t=new Traction({...options(join(dir,'state')),endpoint});await t.choose('on');
   for(let i=0;i<100&&t.running;i++)await new Promise(r=>setTimeout(r,10));
   t.observe('gmail_connected');t.observe('first_abyss');await new Promise(r=>setTimeout(r,80));await settled(t);
   assert.equal(collector.rows.length,3);assert.ok(captured.length>=3);
   for(const body of captured){const p=JSON.parse(body);assert.deepEqual(Object.keys(p).sort(),['app_version','event','install_id','platform']);assert.ok(validPayload(p));}
   const post=body=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body});
   assert.equal((await post(captured[0])).status,204);assert.equal(collector.rows.length,3);
   assert.equal((await post(JSON.stringify({...JSON.parse(captured[0]),subject:'private'}))).status,400);
   assert.equal((await post('{')).status,400);assert.equal((await post('x'.repeat(1100))).status,413);
   assert.equal((await fetch(endpoint)).status,405);
   assert.equal((await stat(collector.file)).mode&0o777,0o600);
   const restart=new TractionCollector({file:collector.file,enabled:true,now:()=>now});await restart.ready;assert.equal(restart.rows.length,3);
   now+=90*DAY;await collector.purge();assert.equal(collector.rows.length,0);assert.deepEqual(JSON.parse(await readFile(collector.file)),[]);
   const disabled=new TractionCollector({file:join(dir,'disabled')});assert.equal(await disabled.handle({url:'/api/milestones'},{}),false);
 } finally {await new Promise(r=>server.close(r));}
}));

test('unreachable endpoint queues bounded milestones and never blocks observer',()=>fixture(async dir=>{
 let now=Date.now();const t=new Traction({...options(join(dir,'state')),now:()=>now,endpoint:'http://127.0.0.1:1/api/milestones'});
 await t.choose('on');assert.equal(t.observe('first_abyss'),undefined);await new Promise(r=>setTimeout(r,30));await settled(t);
 for(const e of EVENTS)t.observe(e);await settled(t);assert.ok(t.state.queue.length<=6);assert.ok(t.retryAt>now);
 let calls=0;t.fetcher=async()=>{calls++;return{ok:true};};t.observe('worker_active');await settled(t);assert.equal(calls,0);
 now+=3600_001;t.observe('worker_active');await settled(t);assert.equal(t.state.queue.length,0);
}));

test('7-day and 30-day boundaries are elapsed-time milestones, not startup milestones',()=>fixture(async dir=>{
 let now=Date.now();const start=now;const sent=[];const t=new Traction({...options(join(dir,'state')),now:()=>now,fetcher:async(_u,o)=>{sent.push(JSON.parse(o.body).event);return{ok:true};}});
 await t.choose('on');t.observe('first_abyss');await settled(t);
 now=start+7*DAY-1;t.observe('worker_active');await settled(t);assert.equal(sent.includes('returned_7d'),false);
 now++;t.observe('worker_active');await settled(t);assert.equal(sent.includes('returned_7d'),true);assert.equal(sent.includes('returned_30d'),false);
 now=start+30*DAY;t.observe('worker_active');await settled(t);assert.equal(sent.includes('returned_30d'),true);
}));

test('quit prevents later observations from creating network traffic',()=>fixture(async dir=>{
 let calls=0;const t=new Traction({...options(join(dir,'state')),fetcher:async()=>{calls++;return{ok:true};}});await t.choose('on');await settled(t);
 t.close();t.observe('first_abyss');await settled(t);assert.equal(calls,1);
}));

test('operator report outputs only aggregate counts and distinguishes unavailable data', async () => {
 const { execFileSync } = await import('node:child_process');
 const dir = await mkdtemp(join(tmpdir(),'spammish-report-'));
 try {
  const id='12345678-1234-4234-8234-123456789abc';
  const day=new Date().toISOString().slice(0,10);
  const rows=['app_started','gmail_connected','first_abyss'].map(event=>({install_id:id,event,app_version:'0.4.3',platform:'darwin',day}));
  await writeFile(join(dir,'events.json'),JSON.stringify([...rows,rows[2]]));
  await writeFile(join(dir,'waitlist.jsonl'),JSON.stringify({email:'private@example.com',consent:'availability'})+'\n');
  const output=execFileSync(process.execPath,['scripts/traction-report.mjs','--events',join(dir,'events.json'),'--waitlist',join(dir,'waitlist.jsonl')],{encoding:'utf8'});
  const report=JSON.parse(output); assert.equal(report.product.first_abyss,1); assert.equal(report.product.rescue_performed,0); assert.equal(report.waitlist.uniqueOptedInEntries,1);
  assert.equal(output.includes(id),false); assert.equal(output.includes('private@example.com'),false);
  const missing=JSON.parse(execFileSync(process.execPath,['scripts/traction-report.mjs','--events',join(dir,'missing')],{encoding:'utf8'}));
  assert.match(missing.product.note,/unavailable/); assert.equal(missing.product.first_abyss,undefined);
 } finally { await rm(dir,{recursive:true,force:true}); }
});

test('stalled network request aborts on deadline without holding the observer',()=>fixture(async dir=>{
 let aborted=false;
 const t=new Traction({...options(join(dir,'state')),fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('timeout'));},{once:true}))});
 await t.choose('on'); assert.equal(t.observe('first_abyss'),undefined);
 await new Promise(r=>setTimeout(r,3200)); assert.equal(aborted,true); assert.equal(t.failed,undefined); assert.equal(t.state.seen.includes('first_abyss'),true); t.close();
}));

test('live receipt retention leaves room for five-day snapshots within the 90-day limit',()=>fixture(async dir=>{
 const { RECEIPT_DAYS }=await import('./traction-schema.mjs'); assert.equal(RECEIPT_DAYS,84);
 let now=Date.parse('2026-01-01T00:00:00Z');
 const file=join(dir,'receipts'); const receipt={install_id:randomUUID(),event:'app_started',app_version:'0.4.4',platform:'darwin',day:'2026-01-01'};
 await writeFile(file,JSON.stringify([receipt]));
 const collector=new TractionCollector({file,enabled:true,now:()=>now});await collector.ready;
 now+=84*DAY-1;await collector.purge();assert.equal(collector.rows.length,1);
 now+=1;await collector.purge();assert.equal(collector.rows.length,0);
 assert.ok(RECEIPT_DAYS+5+1/24<90);
}));
