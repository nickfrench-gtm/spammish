import { createServer } from 'node:http';
import { readFile, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { TractionCollector } from '../lib/traction-collector.mjs';
const root = new URL('./', import.meta.url);
const data = process.env.WAITLIST_DATA_DIR || new URL('../data/', root).pathname;
await mkdir(data, { recursive: true, mode: 0o700 });
const metrics = new TractionCollector({ file: join(data, 'spammish-milestones.json'), enabled: process.env.SPAMMISH_METRICS_ENABLED === 'yes' });
const purgeMetrics = setInterval(() => { if (metrics.enabled) void metrics.purge().catch(() => {}); }, 3600_000); purgeMetrics.unref();
const file = join(data, 'spammish-waitlist.jsonl');
const emails = new Set();
try {
 const saved = await readFile(file, 'utf8');
 const lines = saved.split('\n');
 for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try { const entry = JSON.parse(lines[i]); if (typeof entry.email !== 'string') throw new Error('invalid_waitlist_record'); emails.add(entry.email); }
  catch (error) {
   // Preserve the original before repairing only an interrupted final record.
   if (i !== lines.length - 1) throw error;
   await writeFile(`${file}.recovery-${Date.now()}`, saved, {mode:0o600, flag:'wx', flush:true});
   await writeFile(file, lines.slice(0, i).join('\n') + (i ? '\n' : ''), {mode:0o600, flush:true});
  }
 }
 if (saved && !saved.endsWith('\n') && emails.size) await appendFile(file, '\n', {mode:0o600, flush:true});
} catch (e) { if (e.code !== 'ENOENT') throw e; }
let writes = Promise.resolve();
const limits = new Map();
const headers = { 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'strict-transport-security': 'max-age=31536000' };
const staticFiles = new Map([['/', ['index.html','text/html; charset=utf-8']], ['/privacy', ['privacy.html','text/html; charset=utf-8']], ['/style.css', ['style.css','text/css']], ['/site.js', ['site.js','text/javascript']], ['/assets/abyss/mark-16.png', ['assets/abyss/mark-16.png','image/png']], ['/assets/abyss/mark-32.png', ['assets/abyss/mark-32.png','image/png']], ['/assets/abyss/mark-64.png', ['assets/abyss/mark-64.png','image/png']], ['/assets/abyss/mark-128.png', ['assets/abyss/mark-128.png','image/png']], ['/assets/abyss/mark-256.png', ['assets/abyss/mark-256.png','image/png']], ['/assets/abyss-mark.png',['assets/abyss-mark.png','image/png']], ['/assets/abyss-hero-wide.jpg',['assets/abyss-hero-wide.jpg','image/jpeg']], ['/assets/spammish-banner.jpg',['assets/spammish-banner.jpg','image/jpeg']], ['/assets/abyss-hero.jpg',['assets/abyss-hero.jpg','image/jpeg']], ['/assets/social.png',['assets/social.png','image/png']], ['/assets/display.ttf', ['assets/display.ttf','font/ttf']]]);
const json = (res, status, body) => { res.writeHead(status, { ...headers, 'content-type':'application/json', 'cache-control':'no-store' }); res.end(JSON.stringify(body)); };
createServer(async (req, res) => {
 try {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  if (process.env.REDIRECT_ORIGIN && url.pathname !== '/healthz') {
   if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,409,{error:'Spammish has moved to https://spammish.fly.dev. Open the new site to join the waitlist.'});
   res.writeHead(308,{...headers,location:new URL(url.pathname+url.search,process.env.REDIRECT_ORIGIN).href,'cache-control':'no-store'}); res.end(); return;
  }
  if (await metrics.handle(req, res)) return;
  if (url.pathname === '/api/waitlist' && req.method === 'POST') {
   if (process.env.WAITLIST_PAUSED === 'yes') return json(res,503,{error:'We’re moving the waitlist. Please try again shortly.'});
   const expected = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
   if (req.headers.origin !== expected) return json(res, 403, {error:'Please submit from the Spammish website.'});
   const ip = createHash('sha256').update(req.headers['fly-client-ip'] || req.socket.remoteAddress || '').digest('hex');
   const now = Date.now();
   for (const [key, value] of limits) if (now - value.at > 3600000) limits.delete(key);
   const entry = limits.get(ip) || {at:now,count:0};
   if (++entry.count > 5 || limits.size > 10000) return json(res,429,{error:'Too many attempts. Please try again in an hour.'});
   limits.set(ip,entry);
   let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2048) return json(res,413,{error:'The form is too large.'}); }
   let input; try { input=JSON.parse(body); } catch { return json(res,400,{error:'Please enter a valid email address.'}); }
   if (input.company) return json(res,200,{ok:true});
   const email = String(input.email || '').trim().toLowerCase();
   if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || input.consent !== true) return json(res,400,{error:'Enter your email and agree to receive Spammish availability updates.'});
   const operation = writes.then(async () => { if (emails.has(email)) return; await appendFile(file, JSON.stringify({email, joinedAt:new Date().toISOString(), consent:'easier-experience-availability-v2'})+'\n', {mode:0o600, flush:true}); emails.add(email); });
   writes = operation.catch(()=>{}); await operation;
   return json(res,200,{ok:true});
  }
  const target = staticFiles.get(url.pathname);
  if (!target || !['GET','HEAD'].includes(req.method)) { res.writeHead(404,headers); res.end('Not found'); return; }
  const content = await readFile(new URL(target[0],root));
  res.writeHead(200,{...headers,'content-type':target[1],'cache-control':'no-cache'}); res.end(req.method==='HEAD' ? undefined : content);
 } catch { json(res,503,{error:'We could not save your email. Please try again shortly.'}); }
}).listen(Number(process.env.PORT || 8080), '0.0.0.0');
