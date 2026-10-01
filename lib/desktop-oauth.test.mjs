import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beginDesktopOAuth, installedClient } from './desktop-oauth.mjs';
const client={clientId:'123-fixture.apps.googleusercontent.com',clientSecret:'fixture-desktop-client'};

test('desktop registration rejects a confidential web client',()=>{
 assert.throws(()=>installedClient({web:{client_id:client.clientId,client_secret:'fixture'}}),/desktop_client_required/);
 assert.equal(installedClient({installed:{client_id:client.clientId}}).clientId,client.clientId);
});

test('loopback OAuth checks state, uses PKCE, and never echoes credentials',async()=>{
 let auth;let fields;
 const attempt=await beginDesktopOAuth({client,openBrowser:async(url)=>{auth=new URL(url);},exchange:async(value)=>{fields=value;return {access_token:'fixture-access',refresh_token:'fixture-refresh'};}});
 try {
  assert.equal(auth.hostname,'accounts.google.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
  assert.equal(auth.searchParams.get('scope'),'https://www.googleapis.com/auth/gmail.modify');
  const callback=new URL(auth.searchParams.get('redirect_uri'));
  assert.equal(callback.hostname,'127.0.0.1');
  callback.searchParams.set('state','wrong');callback.searchParams.set('code','fixture-code');
  assert.equal((await fetch(callback)).status,400);
  callback.searchParams.set('state',auth.searchParams.get('state'));
  const response=await fetch(callback);assert.equal(response.status,200);assert.equal((await response.text()).includes('fixture-access'),false);
  const result=await attempt.result;assert.equal(result.refresh_token,'fixture-refresh');
  assert.equal(createHash('sha256').update(fields.code_verifier).digest('base64url'),auth.searchParams.get('code_challenge'));
 }finally{attempt.cancel();}
});

test('cancelled or timed-out OAuth closes the listener and fails explicitly',async()=>{
 const attempt=await beginDesktopOAuth({client,openBrowser:async()=>{}});attempt.cancel();await assert.rejects(attempt.result,/oauth_cancelled/);
 const expiry=await beginDesktopOAuth({client,openBrowser:async()=>{},timeoutMs:20});await assert.rejects(expiry.result,/oauth_timeout/);
});
