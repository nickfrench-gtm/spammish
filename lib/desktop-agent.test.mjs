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
