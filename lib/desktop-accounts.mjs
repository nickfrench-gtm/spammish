import { randomUUID } from 'node:crypto';
import * as gmail from './gmail-agent.mjs';
import { DesktopAgent } from './desktop-agent.mjs';

/** Account routing only. Each mailbox keeps the existing conservative agent. */
export class DesktopAccounts {
  constructor({ store, client, provider = gmail, onChange = () => {}, ...options }) {
    this.store = store;
    this.client = client;
    this.provider = provider;
    this.options = options;
    this.onChange = onChange;
    this.records = new Map(store.load().map((account) => [account.id, account]));
    this.agents = new Map();
    this.generation = 0;
    this.connection = null;
    this.pendingAgent = null;
    for (const id of this.records.keys()) this.agents.set(id, this.makeAgent(id));
  }
  makeAgent(id) {
    const store = {
      load: () => this.records.get(id) || null,
      save: (account) => {
        const prior = this.records.get(id);
        this.records.set(id, { ...account, id });
        try { this.store.save([...this.records.values()]); }
        catch (error) { if (prior) this.records.set(id, prior); else this.records.delete(id); throw error; }
      },
      clear: () => {
        const prior = this.records.get(id);
        this.records.delete(id);
        try { this.store.save([...this.records.values()], { retiredMovedCount: (this.store.retiredMovedCount || 0) + (prior?.movedCount || 0) }); }
        catch (error) { if (prior) this.records.set(id, prior); throw error; }
      },
    };
    return new DesktopAgent({ ...this.options, store, client: this.client, provider: this.provider, onChange: () => this.onChange(this.status()) });
  }
  status() {
    const accounts = [...this.agents.entries()].map(([id, agent]) => ({ id, ...agent.status() })).filter((account) => account.connected);
    return { accounts, movedCount: (this.store.retiredMovedCount || 0) + accounts.reduce((sum, account) => sum + account.movedCount, 0), connected: accounts.length > 0, enabled: accounts.some((a) => a.enabled), sweeping: accounts.some((a) => a.enabled && a.sweeping && !a.error), canConnect: Boolean(this.client?.clientId) };
  }
  get(id) {
    if (typeof id !== 'string' || !this.agents.has(id)) throw new Error('account_not_found');
    return this.agents.get(id);
  }
  connect(tokens, targetId) {
    if (this.connection) return Promise.reject(new Error('operation_cancelled'));
    const generation = this.generation;
    this.connection = this.connectAccount(tokens, targetId, generation).finally(() => { this.connection = null; this.pendingAgent = null; });
    return this.connection;
  }
  async connectAccount(tokens, targetId, generation) {
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('refresh_token_missing');
    const info = await this.provider.profile(tokens.access_token);
    if (generation !== this.generation) throw new Error('operation_cancelled');
    if (typeof info.emailAddress !== 'string' || !info.emailAddress) throw new Error('invalid_connection_response');
    const email = info.emailAddress.toLowerCase();
    const existing = [...this.agents.entries()].find(([, agent]) => agent.status().email?.toLowerCase() === email);
    if (targetId && this.get(targetId).status().email.toLowerCase() !== email) throw new Error('wrong_gmail_account');
    const id = targetId || existing?.[0] || randomUUID();
    const agent = this.agents.get(id) || this.makeAgent(id);
    this.pendingAgent = agent;
    await agent.connect(tokens, { preserveState: Boolean(existing), expectedEmail: email, startEnabled: true });
    if (generation !== this.generation) throw new Error('operation_cancelled');
    this.agents.set(id, agent);
    this.onChange(this.status());
    return { accountId: id, reconnected: Boolean(existing) };
  }
  async enable(id) { return this.get(id).enable(); }
  async pause(id) { return this.get(id).pause(); }
  async pauseAll() { await Promise.all([...this.agents.values()].map((agent) => agent.pause())); }
  async disconnect(id) {
    const result = await this.get(id).disconnect();
    this.agents.delete(id);
    this.onChange(this.status());
    return result;
  }
  async sync() {
    // Slow or revoked access for one Gmail does not block another Gmail.
    const results = await Promise.allSettled([...this.agents.values()].map((agent) => agent.sync()));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    return this.status();
  }
  async cancelConnection() {
    this.generation++;
    if (this.pendingAgent) await this.pendingAgent.stop();
    if (this.connection) await this.connection.catch(() => {});
  }
  async stop() {
    this.generation++;
    await Promise.all([...new Set([...this.agents.values(), this.pendingAgent].filter(Boolean))].map((agent) => agent.stop()));
    if (this.connection) await this.connection.catch(() => {});
  }
}
