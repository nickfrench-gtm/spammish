import { readFile, mkdir, writeFile, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { DAY, validPayload } from './traction-schema.mjs';

export class TractionCollector {
  constructor({ file, enabled = false, now = Date.now }) {
    this.file = file; this.enabled = enabled; this.now = now; this.rows = [];
    this.writes = Promise.resolve(); this.limits = new Map(); this.salt = randomBytes(32);
    this.ready = enabled ? this.load() : Promise.resolve();
    this.ready.catch(() => { this.failed = true; });
  }
  async load() {
    try {
      if ((await stat(this.file)).size > 8_000_000) throw new Error('metrics_store_full');
      const rows = JSON.parse(await readFile(this.file, 'utf8'));
      if (!Array.isArray(rows) || rows.length > 25000 || !rows.every(r => {
        const { day, ...payload } = r; return validPayload(payload) && /^\d{4}-\d{2}-\d{2}$/.test(day);
      })) throw new Error('invalid_metrics_store');
      this.rows = rows;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await this.persist(); // Purge expired rows at startup, even without new traffic.
  }
  async persist() {
    this.rows = this.rows.filter(r => Date.parse(r.day) + 90 * DAY > this.now());
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(this.file + '.tmp', JSON.stringify(this.rows), { mode: 0o600, flush: true });
    await rename(this.file + '.tmp', this.file);
  }
  purge() {
    const task = this.writes.then(async () => { await this.ready; await this.persist(); });
    this.writes = task.catch(() => {}); return task;
  }
  async handle(req, res) {
    if (!this.enabled || req.url !== '/api/milestones') return false;
    const reply = status => { res.writeHead(status, { 'cache-control': 'no-store', 'content-length': '0' }); res.end(); return true; };
    if (req.method !== 'POST') return reply(405);
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415);
    // Transient abuse limiter only; no addresses/headers are written or logged.
    const key = createHash('sha256').update(this.salt).update(req.headers['fly-client-ip'] || req.socket.remoteAddress || '').digest('hex');
    for (const [k,v] of this.limits) if (this.now() - v.at >= 3600_000) this.limits.delete(k);
    const limit = this.limits.get(key) || { at: this.now(), count: 0 };
    if (++limit.count > 60 || this.limits.size >= 10000) return reply(429);
    this.limits.set(key, limit);
    let body = ''; req.setTimeout(3000, () => req.destroy());
    try {
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 1024) return reply(413); }
      let value; try { value = JSON.parse(body); } catch { return reply(400); }
      if (!validPayload(value)) return reply(400);
      const operation = this.writes.then(async () => {
        await this.ready;
        const day = new Date(this.now()).toISOString().slice(0,10);
        const prior = this.rows;
        this.rows = prior.filter(r => Date.parse(r.day) + 90 * DAY > this.now());
        if (!this.rows.some(r => r.install_id === value.install_id && r.event === value.event)) {
          if (this.rows.length >= 25000) throw new Error('metrics_store_full');
          this.rows = [...this.rows, { ...value, day }];
        }
        try { await this.persist(); } catch (error) { this.rows = prior; throw error; }
      });
      this.writes = operation.catch(() => {}); await operation; return reply(204);
    } catch { return reply(503); }
  }
}
