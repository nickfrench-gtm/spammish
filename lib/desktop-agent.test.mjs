import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopAgent } from './desktop-agent.mjs';
import { extractMessage, GoogleRequestError } from './gmail-agent.mjs';

function harness() {
 let persisted = null;
 const messages = new Map();
 const moved = [];
 let failMove = false;
 let historyError = null;
 const coldBody = 'We help teams with lead generation. Open to a 15-minute call?';
 const put = (id, subject, body, labels = ['INBOX','UNREAD'], headers = []) => messages.set(id, { id, labelIds: [...labels], payload: { mimeType: 'text/plain', headers: [{name:'Subject',value:subject}, ...headers], body: {data:Buffer.from(body).toString('base64url'),size:Buffer.byteLength(body)} } });
 put('cold','Re: quick question',coldBody);
 put('legit','Your invoice','Please pay the attached invoice.');
 put('uncertain','Quick question','Can we talk about next week?');
 put('sent','Re: quick question',coldBody,['SENT']);
 put('read','Quick question',coldBody,['INBOX']);
 const store = { load: () => persisted && structuredClone(persisted), save: (value) => { persisted = structuredClone(value); }, clear: () => { persisted=null; } };
 const calls = [];
 const provider = {
  googleTokenRequest: async () => ({access_token:'fixture-access',expires_in:3600}),
  profile: async () => ({emailAddress:'reader@example.com',historyId:'200'}),
  labels: async () => ({labels:[{id:'Label_abyss',name:'The Abyss'}]}),
  createLabel: async () => ({id:'Label_abyss',name:'The Abyss'}),
  listInbox: async () => ({messages: []}),
  history: async (_token,cursor,page) => {
   calls.push(['history',cursor,page]);
   if(historyError) throw historyError;
   return page ? {historyId:'205',history:[{messagesAdded:[{message:{id:'uncertain'}},{message:{id:'sent'}},{message:{id:'read'}}]}]} : {historyId:'205',nextPageToken:'page-two',history:[{messagesAdded:[{message:{id:'cold'}},{message:{id:'legit'}}]}]};
  },
  messageMetadata: async (_token,id) => ({id,labelIds:messages.get(id)?.labelIds||[]}),
  fullMessage: async (_token,id) => structuredClone(messages.get(id)),
  extractMessage,
  moveToAbyss: async (_token,id,labelId) => {
   if(failMove)throw new GoogleRequestError('gmail_api_503',{status:503});
   moved.push(id);
   const msg=messages.get(id);msg.labelIds=msg.labelIds.filter(label=>label!=='INBOX');msg.labelIds.push(labelId);
  },
  revokeToken: async () => { calls.push(['revoke']); },
 };
 const client={clientId:'123-fixture.apps.googleusercontent.com'};
 const agent = new DesktopAgent({store,client,provider});
 return {agent,provider,store,client,messages,moved,calls, fail:()=>{failMove=true;}, recover:()=>{failMove=false;}, historyError:(value)=>{historyError=value;},persisted:()=>persisted};
}
const connected = async (h) => { await h.agent.connect({access_token:'fixture-access',refresh_token:'fixture-refresh'}); await h.agent.enable(); };

test('connect → enable → both history pages: move only cold mail, preserve read/unread state', async () => {
 const h=harness(); await connected(h); await h.agent.sync();
 assert.deepEqual(h.moved,['cold','read']);
 assert.deepEqual(h.messages.get('cold').labelIds,['UNREAD','Label_abyss']);
 assert.deepEqual(h.messages.get('read').labelIds,['Label_abyss']);
 for(const id of ['legit','uncertain']) assert.deepEqual(h.messages.get(id).labelIds,['INBOX','UNREAD']);
 assert.deepEqual(h.calls.filter(call=>call[0]==='history'),[['history','200',undefined],['history','200','page-two']]);
 assert.equal(h.persisted().historyId,'205');
 assert.equal(h.agent.status().error,null);
 assert.equal('refreshToken' in h.agent.status(),false);
});

test('a provider failure retains the cursor and recovers without duplicate changes', async () => {
 const h=harness();await connected(h);h.fail();await h.agent.sync();
 assert.equal(h.persisted().historyId,'200');assert.equal(h.agent.status().error,'connection_interrupted');
 assert.deepEqual(h.moved,[]);h.recover();await h.agent.sync();assert.deepEqual(h.moved,['cold','read']);
 await h.agent.sync();assert.deepEqual(h.moved,['cold','read']);
});

test('pause cancels work before a label mutation and stays paused after restarting', async () => {
 const h=harness();await connected(h);
 let release;let arrived;
 const reached=new Promise(resolve=>{arrived=resolve;});
 h.provider.messageMetadata=async()=>{arrived();return new Promise(resolve=>{release=()=>resolve({labelIds:['INBOX','UNREAD']});});};
 const running=h.agent.sync();await reached;
 const pause=h.agent.pause();release();await pause;await running;
 assert.deepEqual(h.moved,[]);
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});
 assert.equal(restored.status().enabled,false);await restored.sync();assert.deepEqual(h.moved,[]);
});

test('enabled state restores and quit/suspend preserves the intended enabled state',async()=>{
 const h=harness();await connected(h);await h.agent.stop();
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});
 assert.equal(restored.status().enabled,true);await restored.sync();assert.deepEqual(h.moved,['cold','read']);
});

test('expired Gmail history pauses without silently dropping the gap', async () => {
 const h=harness();await connected(h);h.historyError(new GoogleRequestError('gmail_api_404',{status:404}));await h.agent.sync();
 assert.equal(h.agent.status().enabled,false);assert.equal(h.agent.status().error,'history_expired');
 assert.equal(h.persisted().historyId,'200');assert.deepEqual(h.moved,[]);
});

test('a vanished or oversized message does not drop other arrivals',async()=>{
 const h=harness();await connected(h);
 const original=h.provider.fullMessage;
 h.provider.fullMessage=async(token,id)=>{if(id==='legit')throw new GoogleRequestError('gmail_api_404',{status:404});if(id==='uncertain')throw new Error('provider_response_too_large');return original(token,id);};
 await h.agent.sync();assert.deepEqual(h.moved,['cold','read']);assert.equal(h.persisted().historyId,'205');
});

test('revoked Google access pauses and requests reconnect',async()=>{
 const h=harness();await connected(h);h.agent.access=null;
 h.provider.googleTokenRequest=async()=>{throw new GoogleRequestError('google_oauth_invalid_grant',{status:400,oauthError:'invalid_grant'});};
 await h.agent.sync();assert.equal(h.agent.status().enabled,false);assert.equal(h.agent.status().error,'reconnect_required');assert.deepEqual(h.moved,[]);
});

test('disconnect clears credentials and stops all subsequent processing even if revocation is offline',async()=>{
 const h=harness();await connected(h);h.provider.revokeToken=async()=>{throw new Error('offline');};
 const result=await h.agent.disconnect();assert.equal(result.revokePending,true);assert.equal(h.persisted(),null);await h.agent.sync();assert.deepEqual(h.moved,[]);assert.equal(h.agent.status().connected,false);
});

test('text beyond the classification limit remains uncertain and visible',async()=>{
 const h=harness();await connected(h);
 h.messages.get('cold').payload.body={data:Buffer.from('We help with lead generation. Open to a call? '+ 'x'.repeat(20000)).toString('base64url'),size:20050};
 await h.agent.sync();assert.equal(h.moved.includes('cold'),false);assert.equal(h.messages.get('cold').labelIds.includes('INBOX'),true);
});

test('first enable enumerates every inbox page before moving old mail, then catches new arrivals', async () => {
 const h=harness(); const order=[];
 h.provider.history=async()=>({historyId:'210',history:[{messagesAdded:[{message:{id:'new'}}]}]});
 h.messages.set('new',structuredClone({...h.messages.get('cold'),id:'new'}));
 h.messages.get('read').labelIds.push('STARRED','Label_personal');
 const move=h.provider.moveToAbyss;h.provider.moveToAbyss=async(...args)=>{order.push('move');return move(...args);};
 h.provider.listInbox=async(_token,page)=>{order.push(page||'first');return page?{messages:[{id:'read'},{id:'uncertain'},{id:'sent'}]}:{messages:[{id:'cold'},{id:'legit'}],nextPageToken:'second'};};
 await h.agent.connect({access_token:'fixture-access',refresh_token:'fixture-refresh'});
 await h.agent.sync();assert.equal(order.length,0);assert.deepEqual(h.moved,[]); // Connection alone stays paused.
 await h.agent.enable();await h.agent.sync();
 assert.deepEqual(order.slice(0,2),['first','second']);assert.deepEqual(h.moved,['new','cold','read']);
 assert.deepEqual(h.messages.get('read').labelIds,['STARRED','Label_personal','Label_abyss']);
 assert.deepEqual(h.messages.get('cold').labelIds,['UNREAD','Label_abyss']);
 for(const id of ['legit','uncertain'])assert.equal(h.messages.get(id).labelIds.includes('INBOX'),true);
 assert.deepEqual(h.persisted().initialSweep,{phase:'complete'});assert.equal(h.agent.status().sweeping,false);
 await h.agent.pause();await h.agent.enable();await h.agent.sync();assert.equal(order.filter(x=>x==='first').length,1);
});

test('interrupted discovery resumes from its saved page and makes no moves until enumeration finishes',async()=>{
 const h=harness();let offline=true;const pages=[];
 h.provider.history=async()=>({historyId:'205'});
 h.provider.listInbox=async(_token,page)=>{pages.push(page);if(page&&offline)throw new GoogleRequestError('gmail_api_503',{status:503});return page?{messages:[{id:'read'}]}:{messages:[{id:'cold'}],nextPageToken:'second'};};
 await connected(h);await h.agent.sync();assert.deepEqual(h.moved,[]);assert.equal(h.persisted().initialSweep.pageToken,'second');
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});offline=false;await restored.sync();
 assert.deepEqual(pages,[undefined,'second','second']);assert.deepEqual(h.moved,['cold','read']);assert.equal(restored.status().sweeping,false);
});

test('a large inbox sweep resumes after restart without repeating completed moves',async()=>{
 const h=harness();const ids=[];
 for(let i=0;i<105;i++){const id='old-'+i;ids.push({id});h.messages.set(id,structuredClone({...h.messages.get('cold'),id}));}
 h.provider.history=async()=>({historyId:'205'});h.provider.listInbox=async()=>({messages:ids});
 await connected(h);await h.agent.sync();assert.equal(h.moved.length,50);assert.equal(h.persisted().initialSweep.index,50);
 await h.agent.pause();await h.agent.sync();assert.equal(h.moved.length,50);
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});await restored.enable();await restored.sync();assert.equal(h.moved.length,100);
 await restored.sync();assert.equal(h.moved.length,105);assert.equal(new Set(h.moved).size,105);assert.equal(restored.status().sweeping,false);
});

test('failed moves keep the sweep checkpoint and retry safely',async()=>{
 const h=harness();h.provider.history=async()=>({historyId:'205'});h.provider.listInbox=async()=>({messages:[{id:'cold'},{id:'read'}]});
 await connected(h);h.fail();await h.agent.sync();assert.equal(h.persisted().initialSweep.index,0);assert.equal(h.persisted().historyId,'205');
 h.recover();await h.agent.sync();assert.deepEqual(h.moved,['cold','read']);assert.equal(h.agent.status().error,null);
});

test('pause during initial inspection stops before mutation and resumed sweep keeps its queue',async()=>{
 const h=harness();h.provider.history=async()=>({historyId:'205'});h.provider.listInbox=async()=>({messages:[{id:'cold'}]});
 await connected(h);const metadata=h.provider.messageMetadata;let release,entered;
 const reached=new Promise(resolve=>{entered=resolve;});
 h.provider.messageMetadata=async()=>{entered();return new Promise(resolve=>{release=()=>resolve({labelIds:['INBOX','UNREAD']});});};
 const running=h.agent.sync();await reached;const paused=h.agent.pause();release();await paused;await running;
 assert.deepEqual(h.moved,[]);assert.equal(h.persisted().initialSweep.index,0);
 h.provider.messageMetadata=metadata;await h.agent.enable();await h.agent.sync();assert.deepEqual(h.moved,['cold']);
});

test('upgrade schedules one initial sweep, and excludes archived, sent, draft, incomplete and ambiguous mail',async()=>{
 const h=harness();await connected(h);const old=h.persisted();delete old.initialSweep;h.store.save(old);
 h.provider.history=async()=>({historyId:'205'});
 const ids=['cold','legit','uncertain','sent','draft','archived','huge'];
 h.messages.get('sent').labelIds.push('INBOX');
 h.messages.set('draft',structuredClone({...h.messages.get('cold'),id:'draft',labelIds:['INBOX','DRAFT']}));
 h.messages.set('archived',structuredClone({...h.messages.get('cold'),id:'archived',labelIds:['UNREAD']}));
 h.messages.set('huge',structuredClone({...h.messages.get('cold'),id:'huge'}));
 h.messages.get('huge').payload.body={data:Buffer.from('x'.repeat(20000)).toString('base64url'),size:20000};
 h.provider.listInbox=async()=>({messages:ids.map(id=>({id}))});
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});await restored.sync();assert.deepEqual(h.moved,['cold']);
 assert.deepEqual(h.messages.get('draft').labelIds,['INBOX','DRAFT']);assert.equal(restored.status().sweeping,false);
});

test('Gmail rate limits persist a cooldown across restart and exponentially back off', async () => {
 const h=harness();let now=1000000;h.agent.now=()=>now;
 await connected(h);let attempts=0;
 h.provider.history=async()=>{attempts++;throw new GoogleRequestError('gmail_api_403',{status:403,providerReason:'rateLimitExceeded'});};
 await h.agent.sync();assert.equal(attempts,1);assert.equal(h.persisted().retryAt,now+60000);
 await h.agent.sync();assert.equal(attempts,1);
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider,now:()=>now});
 await restored.sync();assert.equal(attempts,1);
 now+=60000;await restored.sync();assert.equal(attempts,2);assert.equal(h.persisted().retryAt,now+120000);
 await restored.pause();assert.equal(restored.status().enabled,false);
});

test('parser upgrade schedules one fresh inbox pass and subsequent restarts preserve progress', async () => {
 const h=harness();await connected(h);await h.agent.sync();
 const old={...h.persisted(),parserVersion:1,initialSweep:{phase:'complete'}};h.store.save(old);
 const upgraded=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});
 assert.equal(upgraded.account.initialSweep.phase,'queued');assert.equal(upgraded.account.parserVersion,2);
 await upgraded.sync();assert.equal(upgraded.account.initialSweep.phase,'complete');
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});
 assert.equal(restored.account.initialSweep.phase,'complete');
});

test('metric counts confirmed moves once; failure, retries and reconnect preserve it', async () => {
 const h=harness();await connected(h);h.fail();await h.agent.sync();assert.equal(h.agent.status().movedCount,0);
 h.recover();await h.agent.sync();assert.equal(h.agent.status().movedCount,2);
 await h.agent.sync();assert.equal(h.agent.status().movedCount,2);
 await h.agent.connect({access_token:'fixture',refresh_token:'fixture-refresh'},{preserveState:true});
 assert.equal(h.agent.status().movedCount,2);
});
test('lost mutation response is recovered after restart without double counting', async () => {
 const h=harness();await connected(h);
 h.provider.history=async()=>({historyId:'205',history:[{messagesAdded:[{message:{id:'cold'}}]}]});
 const original=h.provider.moveToAbyss;h.provider.moveToAbyss=async(...args)=>{await original(...args);throw new Error('network_timeout');};
 await h.agent.sync();assert.equal(h.agent.status().movedCount,0);assert.ok(h.persisted().pendingMove);
 const restored=new DesktopAgent({store:h.store,client:h.client,provider:h.provider});
 await restored.sync();assert.equal(restored.status().movedCount,1);assert.equal(h.persisted().pendingMove,null);assert.equal(h.moved.length,1);
});
test('restoring a moved email protects its sender and does not inflate the counter', async () => {
 const h=harness();h.messages.get('cold').payload.headers.push({name:'From',value:'seller@example.test'});
 h.provider.history=async()=>({historyId:'205',history:[{messagesAdded:[{message:{id:'cold'}}]}]});
 await connected(h);await h.agent.sync();assert.equal(h.agent.status().movedCount,1);
 h.messages.get('cold').labelIds=['INBOX','UNREAD'];await h.agent.sync();assert.equal(h.moved.length,1);
 const fresh=structuredClone({...h.messages.get('cold'),id:'new-pitch'});h.messages.set('new-pitch',fresh);
 h.provider.history=async()=>({historyId:'206',history:[{messagesAdded:[{message:{id:'new-pitch'}}]}]});
 await h.agent.sync();assert.equal(h.moved.length,1);assert.equal(h.agent.status().movedCount,1);
 assert.equal(JSON.stringify(h.persisted()).includes('seller@example.test'),false);
});
test('relationship lookup protects prior outbound and never moves when evidence fails', async () => {
 const h=harness();await connected(h);h.provider.relationshipEvidence=async()=>({outboundToSender:true});
 await h.agent.sync();assert.equal(h.moved.length,0);
 h.provider.relationshipEvidence=async()=>{throw new GoogleRequestError('gmail_api_503',{status:503});};
 await h.agent.sync();assert.equal(h.moved.length,0);assert.equal(h.agent.status().movedCount,0);
});

test('explicit Abyss and Rescue are narrow, reversible corrections and preserve unread state',async()=>{
 const h=harness();await connected(h);await h.agent.pause();
 h.messages.get('uncertain').payload.headers.push({name:'From',value:'Person <person@example.org>'});
 h.provider.messageMetadata=async(_token,id)=>structuredClone(h.messages.get(id));
 h.provider.rescueFromAbyss=async(_token,id,label)=>{const msg=h.messages.get(id);msg.labelIds=msg.labelIds.filter(v=>v!==label);if(!msg.labelIds.includes('INBOX'))msg.labelIds.push('INBOX');};
 await h.agent.abyssMessage('uncertain');assert.equal(h.agent.status().movedCount,1);
 assert.deepEqual(h.messages.get('uncertain').labelIds,['UNREAD','Label_abyss']);
 assert.equal(Object.keys(h.persisted().rejectedSenders).length,1);
 await h.agent.rescueMessage('uncertain');assert.deepEqual(h.messages.get('uncertain').labelIds,['UNREAD','INBOX']);
 assert.equal(h.agent.status().movedCount,1);assert.equal(Object.keys(h.persisted().rejectedSenders).length,0);
 assert.equal(Object.keys(h.persisted().protectedSenders).length,1);
 const explanation=await h.agent.explain('uncertain');assert.equal(explanation.reason,'rescued_sender');
 assert.equal(JSON.stringify(h.persisted()).includes('person@example.org'),false);
 assert.equal(JSON.stringify(h.persisted()).includes('Can we talk'),false);
 await assert.rejects(h.agent.abyssMessage('sent'),/outbound_message_protected/);
 assert.throws(()=>h.agent.rescueMessage('../secret'),/invalid_message_id/);
});

test('external Abyss feedback never turns automatic moves into rejection evidence',async()=>{
 const h=harness();await connected(h);h.provider.messageMetadata=async(_token,id)=>structuredClone(h.messages.get(id));
 h.messages.get('cold').payload.headers.push({name:'From',value:'sales@example.org'});
 await h.agent.sync();await h.agent.observeRejection('cold',()=>true);
 assert.equal(Object.keys(h.persisted().rejectedSenders||{}).length,0);
 h.messages.get('uncertain').payload.headers.push({name:'From',value:'other@example.org'});
 h.messages.get('uncertain').labelIds=['UNREAD','Label_abyss'];
 await h.agent.observeRejection('uncertain',()=>true);
 assert.equal(Object.keys(h.persisted().rejectedSenders).length,1);
 assert.equal(h.agent.status().movedCount,2);
 h.messages.get('uncertain').labelIds=['UNREAD','INBOX'];
 await h.agent.inspectAndMove('uncertain',()=>true);
 assert.equal(Object.keys(h.persisted().rejectedSenders).length,0);
 assert.equal(Object.keys(h.persisted().protectedSenders).length,1);
 h.messages.get('uncertain').labelIds=['UNREAD','Label_abyss'];
 await h.agent.observeRejection('uncertain',()=>true);
 assert.equal(Object.keys(h.persisted().protectedSenders).length,0);
 assert.equal(Object.keys(h.persisted().rejectedSenders).length,1);
 assert.equal(h.agent.status().movedCount,2);
});


test('full pipeline keeps legitimate commercial first contacts and category-only noise', async () => {
 const h=harness();await connected(h);
 let lookups=0;
 h.provider.relationshipEvidence=async()=>{lookups++;return {senderSeen:false,domainSeen:false,outboundToSender:false};};
 const cases=[
  ['customer-inquiry','Product question','We are evaluating software development support for our project. Would you have time to discuss our requirements?'],
  ['recruiter','Engineering role','I am recruiting for an engineering role. Would you have time to discuss the position?'],
  ['social','A new connection','Someone accepted your connection request.'],
  ['security-commercial','Security alert','Our platform for lead generation: book a demo. Your security code is 123456.'],
  ['subscribed','Weekly newsletter','We help teams with lead generation. Open to a 15-minute call?'],
 ];
 for(const [id,subject,body] of cases){
  h.messages.set(id,{id,labelIds:['INBOX','UNREAD'],payload:{mimeType:'text/plain',headers:[{name:'Subject',value:subject},{name:'From',value:`${id}@example.org`}],body:{data:Buffer.from(body).toString('base64url'),size:Buffer.byteLength(body)}}});
  await h.agent.inspectAndMove(id,()=>true);
  assert.deepEqual(h.messages.get(id).labelIds,['INBOX','UNREAD'],id);
 }
 assert.equal(lookups,2);assert.deepEqual(h.moved,[]);
});

test('category-only mail remains outside automatic candidate screening even with rejection feedback',async()=>{
 const h=harness();await connected(h);
 h.messages.set('social',{id:'social',labelIds:['INBOX','UNREAD'],payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'A new connection'},{name:'From',value:'social@example.org'}],body:{data:Buffer.from('Someone accepted your connection request.').toString('base64url')}}});
 h.agent.account.rejectedSenders[h.agent.fingerprint('sender','social@example.org')]=true;
 h.provider.relationshipEvidence=async()=>{throw new Error('category-only mail must not start a relationship lookup');};
 await h.agent.inspectAndMove('social',()=>true);
 assert.deepEqual(h.moved,[]);assert.deepEqual(h.messages.get('social').labelIds,['INBOX','UNREAD']);
});
