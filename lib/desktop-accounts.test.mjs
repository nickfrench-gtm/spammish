import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopAccounts } from './desktop-accounts.mjs';
import { extractMessage, GoogleRequestError } from './gmail-agent.mjs';
function harness(initial = []) {
 let persisted = structuredClone(initial);
 const store = { load: () => structuredClone(persisted), save: (accounts, {retiredMovedCount = store.retiredMovedCount || 0} = {}) => { persisted = structuredClone(accounts); store.retiredMovedCount = retiredMovedCount; } };
 const calls = [];
 const labels = new Map();
 const revoked = [];
 const provider = {
  profile: async (token) => ({ emailAddress: `${token}@example.test`, historyId: `${token}-100` }),
  labels: async (token) => ({ labels: [{ name: 'The Abyss', id: `${token}-abyss` }] }),
  googleTokenRequest: async (body) => ({ access_token: body.refresh_token.replace('refresh-', ''), expires_in: 3600 }),
  listInbox: async () => ({ messages: [{ id: 'same-id' }] }),
  history: async (token) => ({ historyId: `${token}-101`, history: [] }),
  messageMetadata: async (token, id) => ({ id, labelIds: labels.get(token) || ['INBOX', 'UNREAD'] }),
  fullMessage: async (token, id) => ({ id, labelIds: labels.get(token) || ['INBOX', 'UNREAD'], payload: { mimeType: 'text/plain', headers: [{name:'Subject',value:'Re: quick question'}], body: {data:Buffer.from('We help teams with lead generation. Open to a 15-minute call?').toString('base64url')} } }),
  extractMessage,
  moveToAbyss: async (token, id, labelId) => { calls.push({token,id,labelId}); labels.set(token,['UNREAD',labelId]); },
  revokeToken: async (token) => { revoked.push(token); },
 };
 const client = { clientId: 'fixture-client.apps.googleusercontent.com' };
 const manager = new DesktopAccounts({ store, client, provider });
 const connect = (email, id) => manager.connect({access_token: email, refresh_token:`refresh-${email}`}, id);
 return { manager, store, provider, client, connect, calls, revoked, persisted: () => persisted };
}
test('multiple Gmail accounts keep independent credentials, labels, unread state and pause controls', async () => {
 const h=harness();const a=(await h.connect('alice')).accountId;const b=(await h.connect('bob')).accountId;
 assert.equal(h.manager.status().accounts.length,2);
 assert.equal(h.manager.status().enabled,true);
 await h.manager.pause(b);
 await h.manager.enable(a);await h.manager.sync();
 assert.deepEqual(h.calls,[{token:'alice',id:'same-id',labelId:'alice-abyss'}]);
 assert.equal(h.manager.get(b).status().enabled,false);
 await h.manager.enable(b);await h.manager.pause(a);await h.manager.sync();
 assert.deepEqual(h.calls[1],{token:'bob',id:'same-id',labelId:'bob-abyss'});
 assert.equal(h.manager.get(a).status().enabled,false);
 assert.equal(h.manager.get(b).status().enabled,true);
 assert.equal(JSON.stringify(h.manager.status()).includes('refresh-'),false);
 const restored = new DesktopAccounts({store:h.store,client:h.client,provider:h.provider});
 assert.equal(restored.get(a).status().enabled,false);assert.equal(restored.get(b).status().enabled,true);
});
test('duplicate Gmail reconnection preserves progress and other account settings; wrong target is rejected',async()=>{
 const h=harness();const a=(await h.connect('alice')).accountId;const b=(await h.connect('bob')).accountId;
 await h.manager.enable(a);await h.manager.sync();await h.manager.enable(b);
 const before=structuredClone(h.persisted().find(account=>account.id===a).initialSweep);
 const duplicate=await h.connect('alice');assert.equal(duplicate.accountId,a);assert.equal(duplicate.reconnected,true);
 assert.equal(h.manager.status().accounts.length,2);
 assert.deepEqual(h.persisted().find(account=>account.id===a).initialSweep,before);
 assert.equal(h.manager.get(a).status().enabled,true);assert.equal(h.manager.get(b).status().enabled,true);
 const snapshot=h.persisted();await assert.rejects(h.connect('bob',a),/wrong_gmail_account/);assert.deepEqual(h.persisted(),snapshot);
});
test('revoked access and disconnect affect only the selected Gmail',async()=>{
 const h=harness();const a=(await h.connect('alice')).accountId;const b=(await h.connect('bob')).accountId;
 await h.manager.enable(a);await h.manager.enable(b);h.manager.get(b).access=null;
 h.provider.googleTokenRequest=async({refresh_token})=>{if(refresh_token==='refresh-bob')throw new GoogleRequestError('invalid_grant',{oauthError:'invalid_grant',status:400});return {access_token:'alice'};};
 await h.manager.sync();assert.equal(h.manager.get(b).status().error,'reconnect_required');assert.equal(h.manager.get(b).status().enabled,false);
 assert.equal(h.manager.get(a).status().enabled,true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].token,'alice');
 await h.manager.disconnect(b);assert.deepEqual(h.revoked,['refresh-bob']);assert.equal(h.manager.status().accounts.length,1);assert.equal(h.persisted()[0].id,a);assert.equal(h.manager.get(a).status().enabled,true);
 await assert.rejects(h.manager.enable(b),/account_not_found/);
});
test('a slow mailbox does not block the other Gmail, and pausing it cancels its pending move',async()=>{
 const h=harness();const a=(await h.connect('alice')).accountId;const b=(await h.connect('bob')).accountId;
 await h.manager.enable(a);await h.manager.enable(b);
 const metadata=h.provider.messageMetadata;let release;let reached;
 const pending=new Promise(resolve=>{reached=resolve;});
 h.provider.messageMetadata=async(token,id)=>{if(token==='alice'){reached();return new Promise(resolve=>{release=()=>resolve({id,labelIds:['INBOX','UNREAD']});});}return metadata(token,id);};
 const sync=h.manager.sync();await pending;
 await h.manager.get(b).sync();assert.equal(h.calls.some(call=>call.token==='bob'),true);
 const pause=h.manager.pause(a);release();await pause;await sync;
 assert.equal(h.calls.some(call=>call.token==='alice'),false);assert.equal(h.manager.get(b).status().enabled,true);
});
test('stop during a pending new connection prevents saving or enabling it',async()=>{
 const h=harness();const profile=h.provider.profile;let release;let reached;
 const pending=new Promise(resolve=>{reached=resolve;});let calls=0;
 h.provider.profile=async(token)=>{if(++calls===2){reached();return new Promise(resolve=>{release=()=>resolve({emailAddress:`${token}@example.test`,historyId:'100'});});}return profile(token);};
 const connection=h.connect('alice');const rejection=assert.rejects(connection,/operation_cancelled/);await pending;
 const stopped=h.manager.stop();release();await stopped;await rejection;
 assert.deepEqual(h.persisted(),[]);assert.equal(h.manager.status().connected,false);
});

test('cancelling a new connection leaves other Gmail accounts running',async()=>{
 const h=harness();const a=(await h.connect('alice')).accountId;await h.manager.enable(a);
 const profile=h.provider.profile;let release;let reached;let calls=0;
 const pending=new Promise(resolve=>{reached=resolve;});
 h.provider.profile=async(token)=>{if(token==='bob'&&++calls===2){reached();return new Promise(resolve=>{release=()=>resolve({emailAddress:'bob@example.test',historyId:'100'});});}return profile(token);};
 const connection=h.connect('bob');const rejection=assert.rejects(connection,/operation_cancelled/);await pending;
 const cancelled=h.manager.cancelConnection();release();await cancelled;await rejection;
 assert.equal(h.manager.status().accounts.length,1);assert.equal(h.manager.get(a).status().enabled,true);
 await h.manager.sync();assert.equal(h.calls[0].token,'alice');
});

test('connection starts cleanup without enable; adding Gmail preserves a paused mailbox on disk', async () => {
 const h=harness(); const a=(await h.connect('alice')).accountId;
 assert.equal(h.manager.get(a).status().enabled,true);
 await h.manager.sync();
 assert.deepEqual(h.calls,[{token:'alice',id:'same-id',labelId:'alice-abyss'}]);
 await h.manager.pause(a);
 const b=(await h.connect('bob')).accountId;
 assert.equal(h.manager.get(a).status().enabled,false);
 assert.equal(h.manager.get(b).status().enabled,true);
 const restored=new DesktopAccounts({store:h.store,client:h.client,provider:h.provider});
 assert.equal(restored.get(a).status().enabled,false);
 await h.manager.sync(); assert.equal(h.calls[1].token,'bob');
 const progress=structuredClone(h.persisted().find(x=>x.id===a).initialSweep);
 await h.connect('alice');
 assert.equal(h.manager.get(a).status().enabled,true);
 assert.deepEqual(h.persisted().find(x=>x.id===a).initialSweep,progress);
});

test('cancellation while creating the destination prevents automatic startup', async () => {
 const h=harness(); let reached, release;
 const pending=new Promise(resolve=>{reached=resolve;});
 h.provider.labels=async()=>{ reached(); return new Promise(resolve=>{release=()=>resolve({labels:[{name:'The Abyss',id:'fixture-abyss'}]});}); };
 const connection=h.connect('alice');const rejected=assert.rejects(connection,/operation_cancelled/);
 await pending;const cancelled=h.manager.cancelConnection();release();
 await cancelled;await rejected;
 assert.deepEqual(h.persisted(),[]);assert.deepEqual(h.calls,[]);
});

test('one total combines confirmed moves and retains disconnected account counts', async () => {
 const h=harness();const a=(await h.connect('alice')).accountId;const b=(await h.connect('bob')).accountId;
 await h.manager.sync();assert.equal(h.manager.status().movedCount,2);
 await h.manager.disconnect(a);assert.equal(h.manager.status().movedCount,2);
 const restored=new DesktopAccounts({store:h.store,client:h.client,provider:h.provider});assert.equal(restored.status().movedCount,2);
 await restored.disconnect(b);assert.equal(restored.status().movedCount,2);
});
