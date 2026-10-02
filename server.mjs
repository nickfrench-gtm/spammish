import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DesktopAccounts } from './lib/desktop-accounts.mjs';
import { HeadlessStore } from './lib/headless-store.mjs';
import { googleTokenRequest } from './lib/gmail-agent.mjs';
import { explainDecision } from './lib/explain.mjs';
import { cleanupInstruction, quotaNotice } from './desktop/ui/progress.mjs';
import { runtimeProof } from './lib/runtime-proof.mjs';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const requestedPort=Number(process.env.PORT||8080);
if(!Number.isInteger(requestedPort)||requestedPort<0||requestedPort>65535)throw new Error('invalid_port');
const client={clientId:process.env.GOOGLE_CLIENT_ID||'',clientSecret:process.env.GOOGLE_CLIENT_SECRET||''};
const key=Buffer.from(process.env.SPAMMISH_TOKEN_VAULT_KEY||'','base64url');
const store=new HeadlessStore(resolve(process.env.SPAMMISH_DATA_FILE||'./data/spammish.db'),key);
const agent=new DesktopAccounts({store,client});
const states=new Map(),sessions=new Map();
const escape=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(/;\s*/).filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; img-src 'self'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const base=()=>`http://127.0.0.1:${server.address().port}`;
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const redirect=(res,path,extra={})=>{res.writeHead(303,{location:path,'cache-control':'no-store',...extra});res.end();};
function send(res,status,body,extra={}){res.writeHead(status,{...headers,...extra});res.end(body);}
function fields(csrf,account,message){return `<input type="hidden" name="csrf" value="${escape(csrf)}">${account != null ? `<input type="hidden" name="account" value="${escape(account)}">` : ''}${message?`<input type="hidden" name="message" value="${escape(message)}">`:''}`;}
const sessionFor=(req)=>{const token=cookies(req).spammish_session;return token&&sessions.get(token)?.expires>Date.now()?sessions.get(token):null;};
function page(csrf,{notice='',review=[],explanation=null}={}){
 const state=agent.status();
 const rows=state.accounts.map(a=>`<section class="account"><div class="account-heading"><div><p class="email">${escape(a.email)}</p><p>${a.enabled?'On':'Paused'}${a.error?' · Needs attention':''}</p></div><form method="post" action="/toggle">${fields(csrf,a.id)}<button class="account-toggle">${a.enabled?'Pause':'Turn on'}</button></form></div><p>${escape(a.error==='reconnect_required'?'Reconnect this Gmail using Connect another Gmail.':cleanupInstruction(a))}</p>${quotaNotice(a)?`<p class="notice">${escape(quotaNotice(a))}</p>`:''}<div class="secondary-actions"><a class="text-button" href="https://mail.google.com/mail/u/?authuser=${encodeURIComponent(a.email)}#label/The+Abyss" rel="noreferrer">Open The Abyss</a><form method="post" action="/disconnect">${fields(csrf,a.id)}<button class="text-button">Disconnect</button></form></div></section>`).join('');
 const reviewRows=review.map(m=>{const e=explainDecision(m.decision);return `<section class="review-item"><p class="review-subject">${escape(m.subject)}</p><p>${escape(m.from)} · ${escape(m.accountEmail)}</p><details><summary>${escape(e.title)}</summary><p>${escape(e.summary)}</p><ul>${e.factors.map(f=>`<li>${f.points>0?'+':''}${f.points} ${escape(f.label)}</li>`).join('')}</ul></details>${m.inAbyss?`<form method="post" action="/rescue">${fields(csrf,m.accountId,m.id)}<button class="text-button">Rescue</button></form>`:'<p>Already outside The Abyss.</p>'}</section>`;}).join('');
 const current=explanation?`<section><p class="review-subject">${escape(explanation.subject)}</p><p>${escape(explanation.from)}</p><p>${escape(explainDecision(explanation).title)}</p><ul>${explainDecision(explanation).factors.map(f=>`<li>${f.points>0?'+':''}${f.points} ${escape(f.label)}</li>`).join('')}</ul></section>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spammish</title><link rel="stylesheet" href="/style.css"></head><body><main><header><h1><img src="/abyss.png" width="42" height="42" alt="">Spammish</h1><p class="status">${state.enabled?'On':'Paused'}</p></header><section class="intro"><h2>Make unwanted email disappear.</h2><p>Deterministic evidence decides what goes to <strong>The Abyss</strong>. Uncertain mail stays.</p><p class="abyss-total">${state.movedCount} emails sent to The Abyss</p><div class="recovery"><span>Nothing deleted.</span><a class="text-button" href="/review">Rescue a mistake</a></div></section><section class="connection">${rows}${client.clientId&&client.clientSecret?'<a class="text-button" href="/auth/connect">Connect another Gmail</a>':'<p>Configure your Google web OAuth client to connect Gmail. See the <a href="https://github.com/nickfrench-gtm/spammish/blob/main/docs/agent-install.md" rel="noreferrer">setup guide</a>.</p>'}${notice?`<p class="notice">${escape(notice)}</p>`:''}</section><footer><p>No AI API. Keep this process running to protect your inbox.</p><details><summary>Rescue &amp; review filtering</summary><p>In Gmail, Move to → The Abyss records a rejection. Moving a message back to Inbox records a rescue while Spammish runs. Corrections record exact-sender evidence, not an entire-domain rule. Automatic screening and protective gates still apply.</p><p>The counter records confirmed moves since this update. Older desktop moves are not guessed.</p><a class="text-button" href="/review">Show recent moves and reasons</a>${reviewRows||'<p>No recorded moves loaded.</p>'}</details><details><summary>Review a specific message (advanced)</summary><p>Use the Gmail API message ID. Gmail’s browser thread URL is not the same ID.</p><form method="post" action="/explain">${fields(csrf,null)}<label>Gmail account<select name="account">${state.accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.email)}</option>`).join('')}</select></label><label>Message ID<input name="message" required maxlength="128" pattern="[A-Za-z0-9_-]+"></label><button class="text-button">Explain</button><button class="text-button" formaction="/abyss">Abyss</button><button class="text-button" formaction="/rescue">Rescue</button></form>${current}</details></footer></main></body></html>`;
}
async function body(req){let value='';for await(const part of req){value+=part.toString('utf8');if(Buffer.byteLength(value)>8192)throw new Error('request_too_large');}return new URLSearchParams(value);}
const server=createServer(async(req,res)=>{
 try{
  if(![`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`].includes(req.headers.host)){send(res,403,'Invalid host');return;}
  const url=new URL(req.url,base());
  const staticFiles={'/style.css':['desktop/ui/style.css','text/css'],'/abyss.png':['desktop/ui/abyss.png','image/png']};
  if(req.method==='GET'&&staticFiles[url.pathname]){const [path,type]=staticFiles[url.pathname];send(res,200,readFileSync(new URL(path,import.meta.url)),{'content-type':type});return;}
  if(req.method==='GET'&&url.pathname==='/health'){
   const state=agent.status(),healthy=state.accounts.filter(a=>!a.error&&a.lastCheck&&a.lastCheck<=Date.now()&&Date.now()-a.lastCheck<120000);
   send(res,200,JSON.stringify({application:'spammish',runtimeProof:runtimeProof(process.env,url.searchParams.get('challenge'),fileURLToPath(new URL('.',import.meta.url))),version:JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version,connectedAccounts:state.accounts.length,gmailAuthorized:state.accounts.length>0&&healthy.length===state.accounts.length,workerActive:state.enabled,reconnectRequired:state.accounts.some(a=>a.error==='reconnect_required'),lastSuccessfulCheck:Math.max(0,...state.accounts.filter(a=>!a.error).map(a=>a.lastCheck||0))||null}),{'content-type':'application/json; charset=utf-8'});return;
  }
  for(const [token,state] of states)if(state.expires<Date.now())states.delete(token);
  for(const [token,session] of sessions)if(session.expires<Date.now())sessions.delete(token);
  let session=sessionFor(req);
  if(!session){if(req.method!=='GET'){send(res,403,'Session required');return;}if(sessions.size>=128){send(res,429,'Too many local sessions');return;}const token=randomBytes(32).toString('hex');session={csrf:randomBytes(32).toString('hex'),expires:Date.now()+12*60*60*1000};sessions.set(token,session);res.setHeader('set-cookie',`spammish_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);}
  if(req.method==='GET'&&url.pathname==='/'){send(res,200,page(session.csrf));return;}
  if(req.method==='GET'&&url.pathname==='/review'){
   const review=[];for(const account of agent.status().accounts)for(const row of await agent.get(account.id).recentActivity())review.push({...row,accountId:account.id,accountEmail:account.email});
   send(res,200,page(session.csrf,{review:review.sort((a,b)=>b.time-a.time).slice(0,10)}));return;
  }
  if(req.method==='GET'&&url.pathname==='/auth/connect'){
   if(!client.clientId||!client.clientSecret){send(res,400,page(session.csrf,{notice:'Configure Google OAuth before connecting.'}));return;}
   if(states.size>=32){send(res,429,page(session.csrf,{notice:'Too many pending connections.'}));return;}
   const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url');
   const redirectUri=process.env.GOOGLE_REDIRECT_URI||`${base()}/auth/callback`;
   if(![`${base()}/auth/callback`,`http://localhost:${server.address().port}/auth/callback`].includes(redirectUri))throw new Error('loopback_redirect_required');
   states.set(state,{expires:Date.now()+600000,verifier,redirectUri});
   const params=new URLSearchParams({client_id:client.clientId,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.modify',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   res.writeHead(302,{location:`https://accounts.google.com/o/oauth2/v2/auth?${params}`,'set-cookie':`spammish_oauth=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`});res.end();return;
  }
  if(req.method==='GET'&&url.pathname==='/auth/callback'){
   const state=url.searchParams.get('state'),attempt=states.get(state);
   if(!attempt||!equal(state,cookies(req).spammish_oauth)){send(res,400,page(session.csrf,{notice:'Connection state check failed. Try again.'}));return;}
   states.delete(state);
   if(url.searchParams.get('error')){redirect(res,'/');return;}
   const tokens=await googleTokenRequest({code:url.searchParams.get('code'),client_id:client.clientId,client_secret:client.clientSecret,redirect_uri:attempt.redirectUri,code_verifier:attempt.verifier,grant_type:'authorization_code'});
   await agent.connect(tokens);void agent.sync().catch(()=>{});redirect(res,'/',{'set-cookie':'spammish_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});return;
  }
  if(req.method==='POST'){
   if(req.headers.origin&&![base(),`http://localhost:${server.address().port}`].includes(req.headers.origin)){send(res,403,'Origin rejected');return;}
   const form=await body(req);if(!equal(form.get('csrf'),session.csrf)){send(res,403,'CSRF check failed');return;}
   const id=form.get('account'),message=form.get('message'),account=agent.get(id);
   if(url.pathname==='/toggle'){if(account.status().enabled)await agent.pause(id);else{await agent.enable(id);void agent.sync().catch(()=>{});}}
   else if(url.pathname==='/disconnect')await agent.disconnect(id);
   else if(url.pathname==='/abyss')await account.abyssMessage(message);
   else if(url.pathname==='/rescue')await account.rescueMessage(message);
   else if(url.pathname==='/explain'){send(res,200,page(session.csrf,{explanation:await account.explain(message)}));return;}
   else{send(res,404,'Not found');return;}
   redirect(res,'/');return;
  }
  send(res,404,'Not found');
 }catch{send(res,400,page(sessionFor(req)?.csrf||'',{notice:'The action could not finish. Check your configuration or Gmail connection and try again.'}));}
});
server.listen(requestedPort,'127.0.0.1',()=>{console.log(`Spammish is listening at ${base()}`);void agent.sync().catch(()=>{});});
const interval=setInterval(()=>{void agent.sync().catch(()=>{});},20000);interval.unref();
let closing=false;async function close(){if(closing)return;closing=true;clearInterval(interval);await agent.stop();server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',()=>{void close();});process.on('SIGTERM',()=>{void close();});
