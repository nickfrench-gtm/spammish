import * as gmail from './gmail-agent.mjs';
import { classifyForAbyss } from './spammish-policy.mjs';

/** Single-account agent. Message content stays in memory and never enters the store. */
export class DesktopAgent {
  constructor({ store, client, provider = gmail, classify = classifyForAbyss, onChange = () => {}, now = Date.now }) {
    this.store = store;
    this.client = client;
    this.provider = provider;
    this.classify = classify;
    this.onChange = onChange;
    this.now = now;
    this.account = store.load();
    this.access = null;
    this.inflight = null;
    this.generation = 0;
  }

  status() {
    return {
      connected: Boolean(this.account),
      email: this.account?.email || null,
      enabled: Boolean(this.account?.enabled),
      lastCheck: this.account?.lastCheck || null,
      error: this.account?.error || null,
      canConnect: Boolean(this.client?.clientId),
    };
  }

  changed() { this.onChange(this.status()); }
  persist() { this.store.save(this.account); this.changed(); }

  async token() {
    if (!this.account) throw new Error('not_connected');
    if (this.access && this.access.expires > this.now() + 60_000) return this.access.token;
    const result = await this.provider.googleTokenRequest({
      refresh_token: this.account.refreshToken,
      client_id: this.client.clientId,
      ...(this.client.clientSecret ? { client_secret: this.client.clientSecret } : {}),
      grant_type: 'refresh_token',
    });
    if (!result.access_token) throw new Error('invalid_token_response');
    this.access = { token: result.access_token, expires: this.now() + Number(result.expires_in || 3600) * 1000 };
    return this.access.token;
  }

  async connect(tokens) {
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('refresh_token_missing');
    await this.pause();
    const generation = this.generation;
    const info = await this.provider.profile(tokens.access_token);
    const listed = await this.provider.labels(tokens.access_token);
    const abyss = listed.labels?.find((label) => label.name === 'The Abyss') || await this.provider.createLabel(tokens.access_token);
    if (generation !== this.generation) throw new Error('operation_cancelled');
    if (!info.emailAddress || !info.historyId || !abyss.id) throw new Error('invalid_connection_response');
    this.account = {
      email: info.emailAddress, refreshToken: tokens.refresh_token,
      historyId: info.historyId, labelId: abyss.id, enabled: false,
      lastCheck: null, error: null,
    };
    this.access = { token: tokens.access_token, expires: this.now() + Number(tokens.expires_in || 3600) * 1000 };
    this.persist();
    return this.status();
  }

  async enable() {
    if (!this.account) throw new Error('not_connected');
    await this.pause();
    const generation = this.generation;
    const accessToken = await this.token();
    const info = await this.provider.profile(accessToken);
    const listed = await this.provider.labels(accessToken);
    const abyss = listed.labels?.find((label) => label.name === 'The Abyss') || await this.provider.createLabel(accessToken);
    if (generation !== this.generation) throw new Error('operation_cancelled');
    if (!info.historyId || !abyss.id) throw new Error('invalid_connection_response');
    this.account = { ...this.account, historyId: info.historyId, labelId: abyss.id, enabled: true, lastCheck: this.now(), error: null };
    this.generation++;
    this.persist();
    return this.status();
  }

  async pause() {
    this.generation++;
    if (this.account) {
      this.account.enabled = false;
      this.persist();
    }
    if (this.inflight) await this.inflight;
    return this.status();
  }

  async stop() {
    this.generation++;
    if (this.inflight) await this.inflight;
  }

  async disconnect() {
    await this.pause();
    const token = this.account?.refreshToken;
    this.account = null;
    this.access = null;
    this.store.clear();
    this.changed();
    // Local credentials are cleared even if Google is temporarily unreachable.
    if (token) {
      try { await this.provider.revokeToken(token); }
      catch { return { ...this.status(), revokePending: true }; }
    }
    return this.status();
  }

  sync() {
    if (!this.account?.enabled) return Promise.resolve(this.status());
    if (this.inflight) return this.inflight;
    this.inflight = this.process().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async process() {
    const generation = this.generation;
    const active = () => generation === this.generation && this.account?.enabled;
    const startHistoryId = this.account.historyId;
    try {
      const token = await this.token();
      if (!active()) return this.status();
      const ids = new Set();
      let pageToken;
      let nextHistoryId = startHistoryId;
      for (let page = 0; page < 50; page++) {
        let result;
        try { result = await this.provider.history(token, startHistoryId, pageToken); }
        catch (error) {
          if (error.status === 404) throw new Error('history_expired');
          throw error;
        }
        if (!active()) return this.status();
        nextHistoryId = result.historyId || nextHistoryId;
        for (const entry of result.history || []) for (const added of entry.messagesAdded || []) {
          if (added.message?.id) ids.add(added.message.id);
        }
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }
      if (pageToken) throw new Error('history_backlog');
      for (const id of ids) {
        if (!active()) return this.status();
        let message;
        try {
          const metadata = await this.provider.messageMetadata(token, id);
          if (!active()) return this.status();
          if (!(metadata.labelIds || []).includes('INBOX')) continue;
          message = this.provider.extractMessage(await this.provider.fullMessage(token, id));
        } catch (error) {
          if (error.status === 404 || error.message === 'provider_response_too_large') continue; // Vanished or oversized mail stays untouched; continue with the rest.
          throw error;
        }
        if (!active()) return this.status();
        if (!message.inInbox || !this.classify(message).divert) continue;
        // The provider has only one message mutation: add Abyss, remove Inbox.
        await this.provider.moveToAbyss(token, id, this.account.labelId);
      }
      if (active()) {
        this.account = { ...this.account, historyId: nextHistoryId, lastCheck: this.now(), error: null };
        this.persist();
      }
    } catch (error) {
      if (active()) {
        const reconnect = error.oauthError === 'invalid_grant' || error.status === 401;
        const reason = reconnect ? 'reconnect_required' : error.message === 'history_expired' ? 'history_expired' : 'connection_interrupted';
        this.account.error = reason;
        if (reconnect || reason === 'history_expired') this.account.enabled = false;
        this.access = null;
        this.persist();
      }
    }
    return this.status();
  }
}
