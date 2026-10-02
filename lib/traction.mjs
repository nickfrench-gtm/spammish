import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { EVENTS, ENDPOINT, DAY, validPayload } from './traction-schema.mjs';

// Installation-only state. Never accepts account/message/evidence objects.
export class Traction {
  constructor({ file, version, platform = process.platform, suppressed = true, now = Date.now, fetcher = fetch, endpoint = ENDPOINT }) {
    this.file = file; this.version = version; this.platform = platform; this.suppressed = suppressed;
    this.now = now; this.fetcher = fetcher; this.endpoint = endpoint;
    this.state = { choice: 'pending', seen: [], queue: [] }; this.writes = Promise.resolve();
    this.ready = this.load().catch(() => { this.failed = true; });
  }
  async load() {
    try {
      if ((await stat(this.file)).size > 8192) throw new Error('invalid_metrics_state');
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (!['pending','off','on'].includes(value.choice) || !Array.isArray(value.seen) || !Array.isArray(value.queue)
        || value.seen.length > 6 || value.queue.length > 6 || !value.seen.every(e => EVENTS.includes(e))
        || !value.queue.every(e => EVENTS.includes(e)) || value.choice === 'on' && (!validPayload({ install_id: value.id, event: 'app_started', app_version: this.version, platform: this.platform }) || !Number.isFinite(value.since))) throw new Error('invalid_metrics_state');
      this.state = { choice: value.choice, id: value.choice === 'on' ? value.id : undefined, since: value.since, seen: [...new Set(value.seen)], queue: [...new Set(value.queue)] };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  status() { return { choice: this.state.choice, suppressed: this.suppressed, available: !this.failed }; }
  save() {
    const snapshot = JSON.stringify(this.state);
    this.writes = this.writes.catch(() => {}).then(async () => {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      await writeFile(this.file + '.tmp', snapshot, { mode: 0o600, flush: true });
      await rename(this.file + '.tmp', this.file);
    }).catch(() => { this.failed = true; this.controller?.abort(); });
    return this.writes;
  }
  async choose(choice) {
    await this.ready;
    if (!['on','off'].includes(choice) || this.failed || this.suppressed) return false;
    if (choice === 'off') {
      this.controller?.abort(); this.state = { choice: 'off', seen: [], queue: [] };
    } else if (this.state.choice !== 'on') {
      this.state = { choice: 'on', id: randomUUID(), since: this.now(), seen: ['app_started'], queue: ['app_started'] };
    }
    await this.save(); this.flush(); return !this.failed;
  }
  observe(event) {
    // No caller waits for disk or network; rejected observers cannot reach Gmail.
    void this.ready.then(() => {
      if (this.closed || this.failed || this.suppressed || this.state.choice !== 'on') return;
      if (event === 'worker_active') {
        this.record('gmail_connected');
        if (this.state.seen.includes('first_abyss')) {
          for (const [days, name] of [[7,'returned_7d'], [30,'returned_30d']]) if (this.now() - this.state.since >= days * DAY) this.record(name);
        }
      } else if (EVENTS.includes(event)) this.record(event);
      this.flush();
    }).catch(() => {});
  }
  record(event) {
    if (this.state.seen.includes(event)) return;
    this.state.seen.push(event); this.state.queue.push(event); void this.save();
  }
  flush() {
    if (this.closed || this.running || this.failed || this.suppressed || this.state.choice !== 'on' || this.now() < (this.retryAt || 0)) return;
    this.running = true;
    void this.send().catch(() => { this.retryAt = this.now() + 3600_000; }).finally(() => { this.running = false; });
  }
  async send() {
    await this.writes;
    while (!this.closed && !this.failed && !this.suppressed && this.state.choice === 'on' && this.state.queue.length) {
      const id = this.state.id, event = this.state.queue[0];
      const payload = { install_id: id, event, app_version: this.version, platform: this.platform };
      if (!validPayload(payload)) { this.failed = true; return; }
      this.controller = new AbortController();
      const timer = setTimeout(() => this.controller?.abort(), 3000); timer.unref?.();
      try {
        const response = await this.fetcher(this.endpoint, { method: 'POST', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'content-type': 'application/json', 'user-agent': 'Spammish-milestones/1' }, body: JSON.stringify(payload), signal: this.controller.signal });
        if (!response.ok) throw new Error('metrics_unavailable');
        await response.body?.cancel();
        if (this.state.choice !== 'on' || this.state.id !== id) return;
        this.state.queue = this.state.queue.filter(e => e !== event); await this.save();
      } finally { clearTimeout(timer); this.controller = null; }
    }
  }
  close() { this.closed = true; this.controller?.abort(); }
}
