import { createHmac, randomBytes } from 'node:crypto';
import * as gmail from './gmail-agent.mjs';
import { classifyForAbyss, POLICY_VERSION, senderAddress } from './spammish-policy.mjs';

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
    // Older previews did not sweep existing mail. Upgrade them once, preserving the arrival cursor.
    if (this.account && !this.account.initialSweep) this.account.initialSweep = { phase: 'queued', ids: [], index: 0, pageToken: null };
    // Revisit mail skipped by the old MIME parser exactly once after upgrading.
    if (this.account && this.account.parserVersion !== 2) {
      this.account.initialSweep = { phase: 'queued', ids: [], index: 0, pageToken: null };
      this.account.parserVersion = 2;
    }
    if (this.account && this.account.policyVersion !== POLICY_VERSION) {
      const sweep = this.account.initialSweep;
      // Recheck previously processed IDs under the new policy without repeating
      // a completed discovery pass or dropping the persisted quota cooldown.
      this.account.initialSweep = sweep?.phase === 'processing' && Array.isArray(sweep.ids)
        ? { ...sweep, index: 0 } : { phase: 'queued', ids: [], index: 0, pageToken: null };
      this.account.policyVersion = POLICY_VERSION;
    }
    this.access = null;
    this.inflight = null;
    this.manual = null;
    this.generation = 0;
  }

  status() {
    return {
      connected: Boolean(this.account),
      movedCount: this.account?.movedCount || 0,
      email: this.account?.email || null,
      enabled: Boolean(this.account?.enabled),
      lastCheck: this.account?.lastCheck || null,
      error: this.account?.error || null,
      failureReason: this.account?.failureReason || null,
      failureStatus: this.account?.failureStatus || null,
      retryAt: this.account?.retryAt || null,
      canConnect: Boolean(this.client?.clientId),
      sweepProgress: this.account?.initialSweep?.phase === 'processing' ? { processed: this.account.initialSweep.index || 0, total: this.account.initialSweep.ids.length } : null,
      sweepPhase: this.account?.initialSweep?.phase || null,
      sweeping: Boolean(this.account && this.account.initialSweep?.phase !== 'complete'),
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

  async connect(tokens, { preserveState = false, expectedEmail, startEnabled = false } = {}) {
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('refresh_token_missing');
    const connectingGeneration = this.generation;
    const prior = preserveState ? this.account : null;
    const info = await this.provider.profile(tokens.access_token);
    if (connectingGeneration !== this.generation) throw new Error('operation_cancelled');
    if (expectedEmail && info.emailAddress?.toLowerCase() !== expectedEmail) throw new Error('wrong_gmail_account');
    await this.pause();
    if (this.generation !== connectingGeneration + 1) throw new Error('operation_cancelled');
    const generation = this.generation;
    const listed = await this.provider.labels(tokens.access_token);
    const abyss = listed.labels?.find((label) => label.name === 'The Abyss') || await this.provider.createLabel(tokens.access_token);
    if (generation !== this.generation) throw new Error('operation_cancelled');
    if (!info.emailAddress || !info.historyId || !abyss.id) throw new Error('invalid_connection_response');
    this.account = {
      email: info.emailAddress, refreshToken: tokens.refresh_token, parserVersion: 2, policyVersion: POLICY_VERSION,
      movedCount: prior?.movedCount || 0, moveLedger: prior?.moveLedger || {}, protectedSenders: prior?.protectedSenders || {},
      metricSalt: prior?.metricSalt || randomBytes(32).toString('hex'), pendingMove: prior?.pendingMove || null, rejectedSenders: prior?.rejectedSenders || {}, recentDecisions: prior?.recentDecisions || [],
      historyId: prior?.historyId || info.historyId, labelId: abyss.id, enabled: startEnabled,
      lastCheck: prior?.lastCheck || null, error: null,
      initialSweep: prior?.initialSweep || { phase: 'queued', ids: [], index: 0, pageToken: null },
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
    this.account = { ...this.account, historyId: this.account.error === 'history_expired' ? info.historyId : this.account.historyId, initialSweep: this.account.error === 'history_expired' ? { phase: 'queued', ids: [], index: 0, pageToken: null } : this.account.initialSweep, labelId: abyss.id, enabled: true, lastCheck: this.now(), error: null };
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
    if (this.manual) await this.manual.catch(() => {});
    return this.status();
  }

  async stop() {
    this.generation++;
    if (this.inflight) await this.inflight;
    if (this.manual) await this.manual.catch(() => {});
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
    if (this.manual || !this.account?.enabled || this.account.retryAt > this.now()) return Promise.resolve(this.status());
    if (this.inflight) return this.inflight;
    this.inflight = this.process().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async collectInbox(active) {
    const sweep = this.account.initialSweep;
    if (!['queued', 'collecting'].includes(sweep.phase)) return;
    sweep.phase = 'collecting';
    const ids = new Set(sweep.ids);
    // Enumerate before moving anything: removing Inbox during pagination can skip older messages.
    for (let page = 0; page < 10 && active(); page++) {
      let result;
      try { result = await this.provider.listInbox(await this.token(), sweep.pageToken || undefined); }
      catch (error) {
        if (active() && error.status === 400 && sweep.pageToken) {
          sweep.pageToken = null; // Expired page token: rediscover without losing collected IDs.
          this.persist();
        }
        throw error;
      }
      if (!active()) return;
      if (result.messages != null && !Array.isArray(result.messages)) throw new Error('invalid_provider_response');
      for (const message of result.messages || []) {
        if (typeof message.id !== 'string' || !message.id) throw new Error('invalid_provider_response');
        ids.add(message.id);
      }
      sweep.ids = [...ids];
      sweep.pageToken = result.nextPageToken || null;
      if (!sweep.pageToken) sweep.phase = 'processing';
      this.persist();
      if (!sweep.pageToken) break;
    }
  }

  fingerprint(kind, value) {
    this.account.metricSalt ||= randomBytes(32).toString('hex');
    return createHmac('sha256', this.account.metricSalt).update(`${kind}:${value}`).digest('hex');
  }

  finishMove(pending) {
    this.account.moveLedger ||= {};
    if (!this.account.moveLedger[pending.key]?.counted) {
      this.account.movedCount = (this.account.movedCount || 0) + 1;
      this.account.moveLedger[pending.key] = { sender: pending.senderKey, counted: true };
      this.account.recentDecisions ||= [];
      this.account.recentDecisions.push({ id: pending.id, time: this.now(), decision: pending.decision });
      this.account.recentDecisions = this.account.recentDecisions.slice(-50);
      const keys = Object.keys(this.account.moveLedger);
      if (keys.length > 50_000) delete this.account.moveLedger[keys[0]];
    }
    if (this.account.moveLedger[pending.key]) this.account.moveLedger[pending.key].rescued = false;
    this.account.pendingMove = null;
    this.persist();
  }

  async recoverPending(active) {
    const pending = this.account.pendingMove;
    if (!pending || !active()) return;
    let metadata;
    try { metadata = await this.provider.messageMetadata(await this.token(), pending.id); }
    catch (error) { if (error.status !== 404) throw error; this.account.pendingMove = null; this.persist(); return; }
    if (!active()) return;
    const labels = metadata.labelIds || [];
    if (labels.includes(this.account.labelId) && !labels.includes('INBOX')) this.finishMove(pending);
    else { this.account.pendingMove = null; this.persist(); }
  }

  async inspectAndMove(id, active) {
    let message;
    try {
      const metadata = await this.provider.messageMetadata(await this.token(), id);
      if (!active()) return;
      const labels = metadata.labelIds || [];
      if (!labels.includes('INBOX') || labels.includes('SENT') || labels.includes('DRAFT')) return;
      // A previously moved message back in Inbox is a rescue, not fresh spam.
      const previous = this.account.moveLedger?.[this.fingerprint('message', id)];
      if (previous) {
        if (previous.sender) { this.account.protectedSenders ||= {}; this.account.protectedSenders[previous.sender] = true; delete this.account.rejectedSenders?.[previous.sender]; previous.rescued = true; this.persist(); }
        return;
      }
      message = this.provider.extractMessage(await this.provider.fullMessage(await this.token(), id));
      if (!active() || !message.inInbox) return;
      const sender = senderAddress(message.from);
      const senderKey = sender ? this.fingerprint('sender', sender) : null;
      const senderRejected = Boolean(this.account.rejectedSenders?.[senderKey]);
      // Corrections must reach the evidence model even for a low initial score.
      if (this.account.protectedSenders?.[senderKey]) return;
      const initial = this.classify(message);
      const candidate = senderRejected || initial.score >= 30 || initial.signals?.obviousSpam || initial.signals?.warmup
        || initial.signals?.salesCallToAction && (initial.signals?.coldSubjectPhrase || initial.signals?.coldOpening);
      if (['incomplete_message', 'subscription_context'].includes(initial.reason) || initial.signals?.importantGuard || !candidate) return;
      let relationship = {};
      if (this.account.protectedSenders?.[senderKey]) relationship.rescued = true;
      else if (this.provider.relationshipEvidence) relationship = await this.provider.relationshipEvidence(await this.token(), message);
      relationship.senderRejected = senderRejected;
      const decision = this.classify(message, relationship);
      if (!active() || !decision.divert) return;
      const pending = { decision: this.safeDecision(decision), id, key: this.fingerprint('message', id), senderKey };
      // Save intent before the Gmail mutation; confirm it after a crash or lost response.
      this.account.pendingMove = pending; this.persist();
      const token = await this.token();
      if (!active()) { this.account.pendingMove = null; this.persist(); return; }
      await this.provider.moveToAbyss(token, id, this.account.labelId);
      this.finishMove(pending);
    } catch (error) {
      if (error.status === 404 || error.message === 'provider_response_too_large') return;
      throw error;
    }
  }

  safeDecision(decision) {
    return { score: decision.score, threshold: decision.threshold, reason: decision.reason,
      evidence: decision.evidence.map(({ code, points }) => ({ code, points })) };
  }
  validMessageId(id) { if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid_message_id'); return id; }
  async explain(id) {
    this.validMessageId(id);
    const message = this.provider.extractMessage(await this.provider.fullMessage(await this.token(), id));
    const sender = senderAddress(message.from);
    const key = sender ? this.fingerprint('sender', sender) : null;
    const relationship = this.provider.relationshipEvidence ? await this.provider.relationshipEvidence(await this.token(), message) : {};
    relationship.rescued = Boolean(this.account.protectedSenders?.[key]);
    relationship.senderRejected = Boolean(this.account.rejectedSenders?.[key]);
    return { id, subject: message.subject, from: message.from, ...this.safeDecision(this.classify(message, relationship)) };
  }
  async recentMoves() {
    const rows = [];
    for (const row of (this.account?.recentDecisions || []).slice(-10).reverse()) {
      try {
        const raw = await this.provider.messageMetadata(await this.token(), row.id);
        const headers = Object.fromEntries((raw.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
        rows.push({ id: row.id, time: row.time, subject: headers.subject || 'Email', from: headers.from || '', inAbyss: raw.labelIds?.includes(this.account.labelId), decision: row.decision });
      } catch (error) { if (error.status !== 404) throw error; }
    }
    return rows;
  }
  correction(task) {
    if (this.manual) return Promise.reject(new Error('operation_cancelled'));
    const generation = ++this.generation;
    const active = () => generation === this.generation && Boolean(this.account);
    this.manual = (async () => {
      if (this.inflight) await this.inflight;
      if (!active()) throw new Error('operation_cancelled');
      await this.recoverPending(active);
      if (!active()) throw new Error('operation_cancelled');
      return task(active);
    })().finally(() => { this.manual = null; });
    return this.manual;
  }
  abyssMessage(id) {
    this.validMessageId(id);
    return this.correction(async (active) => {
      const raw = await this.provider.messageMetadata(await this.token(), id);
      if (!active()) throw new Error('operation_cancelled');
      if (raw.labelIds?.includes('SENT') || raw.labelIds?.includes('DRAFT')) throw new Error('outbound_message_protected');
      const from = raw.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value;
      const sender = senderAddress(from), senderKey = sender ? this.fingerprint('sender', sender) : null;
      if (senderKey) { this.account.rejectedSenders ||= {}; this.account.rejectedSenders[senderKey] = true; delete this.account.protectedSenders?.[senderKey]; }
      this.persist();
      if (raw.labelIds?.includes(this.account.labelId) && !raw.labelIds?.includes('INBOX')) return this.status();
      const pending = { id, key: this.fingerprint('message', id), senderKey, decision: { score: null, reason: 'explicit_rejection', evidence: [] } };
      this.account.pendingMove = pending; this.persist();
      if (!active()) throw new Error('operation_cancelled');
      await this.provider.moveToAbyss(await this.token(), id, this.account.labelId);
      this.finishMove(pending);
      return this.status();
    });
  }
  rescueMessage(id) {
    this.validMessageId(id);
    return this.correction(async (active) => {
      const raw = await this.provider.messageMetadata(await this.token(), id);
      if (!active()) throw new Error('operation_cancelled');
      const from = raw.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value;
      const sender = senderAddress(from), key = sender ? this.fingerprint('sender', sender) : null;
      if (key) { this.account.protectedSenders ||= {}; this.account.protectedSenders[key] = true; delete this.account.rejectedSenders?.[key]; }
      const receipt = this.account.moveLedger?.[this.fingerprint('message', id)];
      if (receipt) receipt.rescued = true;
      this.persist();
      if (!raw.labelIds?.includes(this.account.labelId)) return this.status();
      if (!active()) throw new Error('operation_cancelled');
      await this.provider.rescueFromAbyss(await this.token(), id, this.account.labelId);
      return this.status();
    });
  }
  async observeRejection(id, active) {
    const key = this.fingerprint('message', id);
    const previous = this.account.moveLedger?.[key];
    if (previous && !previous.rescued) return; // Our own moves never manufacture rejection evidence.
    const raw = await this.provider.messageMetadata(await this.token(), id);
    if (!active() || !raw.labelIds?.includes(this.account.labelId) || raw.labelIds?.includes('SENT') || raw.labelIds?.includes('DRAFT')) return;
    const sender = senderAddress(raw.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value);
    const senderKey = sender ? this.fingerprint('sender', sender) : null;
    if (senderKey) { this.account.rejectedSenders ||= {}; this.account.rejectedSenders[senderKey] = true; delete this.account.protectedSenders?.[senderKey]; }
    this.account.moveLedger ||= {}; this.account.moveLedger[key] = { sender: senderKey, counted: previous?.counted || false, rescued: false };
    const keys = Object.keys(this.account.moveLedger);
    if (keys.length > 50_000) delete this.account.moveLedger[keys[0]];
    this.persist();
  }

  async sweepBatch(active) {
    const sweep = this.account.initialSweep;
    if (sweep.phase !== 'processing') return;
    for (let count = 0; count < 50 && sweep.index < sweep.ids.length && active(); count++) {
      await this.inspectAndMove(sweep.ids[sweep.index], active);
      if (!active()) return;
      sweep.index++;
      // Persist each completed item. A crash may repeat an inspection, never a destructive action.
      this.persist();
    }
    if (active() && sweep.index === sweep.ids.length) {
      this.account.initialSweep = { phase: 'complete' }; // Drop temporary message IDs after the sweep.
      this.persist();
    }
  }

  async process() {
    const generation = this.generation;
    const active = () => generation === this.generation && this.account?.enabled;
    const startHistoryId = this.account.historyId;
    try {
      const token = await this.token();
      if (!active()) return this.status();
      await this.recoverPending(active);
      if (!active()) return this.status();
      await this.collectInbox(active);
      if (!active() || this.account.initialSweep.phase === 'collecting') return this.status();
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
        for (const entry of result.history || []) for (const added of entry.labelsAdded || []) {
          if (added.labelIds?.includes(this.account.labelId) && added.message?.id) await this.observeRejection(added.message.id, active);
          if (added.labelIds?.includes('INBOX') && added.message?.id) ids.add(added.message.id);
        }
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }
      if (pageToken) throw new Error('history_backlog');
      for (const id of ids) {
        if (!active()) return this.status();
        await this.inspectAndMove(id, active);
      }
      if (active()) {
        this.account = { ...this.account, historyId: nextHistoryId, lastCheck: this.now(), error: null, failureStatus: null, failureCode: null, failureReason: null };
        this.persist();
        await this.sweepBatch(active);
        if (active()) { this.account.retryAt = null; this.account.retryCount = 0; this.persist(); }
      }
    } catch (error) {
      if (active()) {
        const reconnect = error.oauthError === 'invalid_grant' || error.status === 401;
        const reason = reconnect ? 'reconnect_required' : error.message === 'history_expired' ? 'history_expired' : 'connection_interrupted';
        this.account.error = reason;
        // Status/code only: useful local diagnostics without provider text or mail contents.
        this.account.failureReason = error.providerReason || null;
        if (error.status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded'].includes(error.providerReason)) {
          this.account.retryCount = (this.account.retryCount || 0) + 1;
          const daily = error.providerReason === 'dailyLimitExceeded';
          this.account.retryAt = this.now() + (daily ? 60 * 60_000 : Math.min(15 * 60_000, 60_000 * 2 ** Math.min(4, this.account.retryCount - 1)));
        }
        this.account.failureStatus = Number.isInteger(error.status) ? error.status : null;
        this.account.failureCode = /^(gmail_api_[0-9]{3}|invalid_provider_response|provider_response_too_large|history_backlog)$/.test(error.message) ? error.message : 'request_interrupted';
        if (reconnect || reason === 'history_expired') this.account.enabled = false;
        this.access = null;
        this.persist();
      }
    }
    return this.status();
  }
}
