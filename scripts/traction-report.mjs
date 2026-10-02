import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { EVENTS, DAY, RECEIPT_DAYS, validPayload } from '../lib/traction-schema.mjs';
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i+1]; };
const report = { interpretation: 'Participating installations, not verified people or strangers. Opt-outs are invisible; reset/reinstall/forks/spoofing can distort counts.', repo: { window: 'GitHub rolling 14 days; do not sum overlapping unique counts', visitors: null, clones: null, releaseAssetDownloads: null }, product: null, waitlist: null };
if (args.includes('--github')) {
  try {
    const api = path => JSON.parse(execFileSync('gh', ['api',path], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:10000, maxBuffer:2_000_000 }));
    report.repo.visitors = api('repos/nickfrench-gtm/spammish/traffic/views').uniques;
    report.repo.clones = api('repos/nickfrench-gtm/spammish/traffic/clones').uniques;
    report.repo.releaseAssetDownloads = api('repos/nickfrench-gtm/spammish/releases?per_page=100').flatMap(r => r.assets).reduce((n,a) => n + a.download_count,0);
  } catch { report.repo.note = 'GitHub metrics unavailable; use repository Insights → Traffic with owner authentication.'; }
}
if (option('--events')) {
  try {
    const rows = JSON.parse(await readFile(option('--events'),'utf8'));
    if (!Array.isArray(rows) || !rows.every(({day,...p}) => validPayload(p) && /^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error('invalid');
    const current = rows.filter(r => Date.parse(r.day) + RECEIPT_DAYS * DAY > Date.now());
    const starts = new Set(current.filter(r => r.event === 'app_started').map(r => r.install_id));
    report.product = Object.fromEntries(EVENTS.map(e => [e,new Set(current.filter(r => r.event === e && starts.has(r.install_id)).map(r => r.install_id)).size]));
    report.product.window = 'Live receipt dates retained up to 84 days; milestone counts for IDs with an app_started receipt in this window';
  } catch { report.product = { note: 'Event data unavailable or invalid; no zero-usage inference is valid.' }; }
}
if (option('--waitlist')) {
  try {
    const rows = (await readFile(option('--waitlist'),'utf8')).split('\n').filter(Boolean).map(JSON.parse);
    if (!rows.every(r => typeof r.email === 'string' && typeof r.consent === 'string')) throw new Error('invalid');
    report.waitlist = { uniqueOptedInEntries: new Set(rows.map(r => r.email)).size, note: 'Separate demand signal; no join with installation IDs and no email addresses output.' };
  } catch { report.waitlist = { note: 'Waitlist data unavailable or invalid.' }; }
}
console.log(JSON.stringify(report,null,2));
