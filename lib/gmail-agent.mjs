import { setTimeout as delay } from 'node:timers/promises';

let nextRequestAt = 0;
async function paceGmailRequests() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + 250;
  if (wait) await delay(wait);
}

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const json = async (response) => {
  const chunks = [];
  let bytes = 0;
  if (!response.body) return {};
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > 2 * 1024 * 1024) throw new Error('provider_response_too_large');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('invalid_provider_response'); }
};

export class GoogleRequestError extends Error {
  constructor(code, { status, oauthError, providerReason } = {}) {
    super(code);
    this.status = status;
    this.oauthError = oauthError;
    this.providerReason = providerReason;
  }
}

export async function googleTokenRequest(fields) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await json(response);
  if (!response.ok) throw new GoogleRequestError(`google_oauth_${result.error || response.status}`, { status: response.status, oauthError: result.error });
  return result;
}

async function gmail(path, token, { method = "GET", body, query = {} } = {}) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) for (const item of value) url.searchParams.append(key, String(item));
    else url.searchParams.set(key, String(value));
  }
  await paceGmailRequests();
  const response = await fetch(url, { method, signal: AbortSignal.timeout(30_000), headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await json(response);
  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason;
    const known = ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded', 'backendError', 'forbidden', 'domainPolicy', 'insufficientPermissions'];
    throw new GoogleRequestError(`gmail_api_${response.status}`, { status: response.status, providerReason: known.includes(reason) ? reason : 'unknown' });
  }
  return result;
}

export const profile = (token) => gmail("/profile", token);
export const history = (token, startHistoryId, pageToken) => gmail("/history", token, { query: { startHistoryId, historyTypes: "messageAdded", maxResults: 100, pageToken } });
export const listInbox = (token, pageToken) => gmail('/messages', token, { query: { labelIds: 'INBOX', includeSpamTrash: false, maxResults: 500, pageToken, fields: 'messages(id),nextPageToken' } });
export const messageMetadata = (token, id) => gmail(`/messages/${encodeURIComponent(id)}`, token, { query: { format: "metadata", metadataHeaders: ["From", "Subject"], fields: "id,labelIds,payload(headers)" } });
export const fullMessage = (token, id) => gmail(`/messages/${encodeURIComponent(id)}`, token, { query: { format: "full", fields: "id,labelIds,payload(headers,mimeType,body(data,size),parts(mimeType,body(data,size),parts(mimeType,body(data,size),parts(mimeType,body(data,size)))))" } });
export const labels = (token) => gmail("/labels", token);
export const createLabel = (token) => gmail("/labels", token, { method: "POST", body: { name: "The Abyss", labelListVisibility: "labelShow", messageListVisibility: "show" } });
export const moveToAbyss = (token, id, labelId) => {
  if (!/^Label_[A-Za-z0-9_-]+$/.test(labelId)) throw new Error('abyss_label_invalid');
  return gmail(`/messages/${encodeURIComponent(id)}/modify`, token, { method: "POST", body: { addLabelIds: [labelId], removeLabelIds: ["INBOX"] } });
};

export async function revokeToken(token) {
  const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new GoogleRequestError('token_revocation_failed', { status: response.status });
}

export function extractMessage(message) {
  const headers = Object.fromEntries((message.payload?.headers || []).map(({ name, value }) => [String(name).toLowerCase(), value]));
  const plain = [], html = [];
  let structureIncomplete = false;
  const maxPartBytes = 256 * 1024;
  const visit = (part) => {
    if (part?.mimeType?.startsWith('multipart/') && !part.parts?.length) structureIncomplete = true;
    if (['text/plain', 'text/html'].includes(part?.mimeType)) {
      const encoded = String(part.body?.data || '');
      const unavailable = part.body?.size > 0 && !encoded;
      const oversized = encoded.length > Math.ceil(maxPartBytes / 3) * 4 || part.body?.size > maxPartBytes;
      const decoded = unavailable || oversized ? '' : Buffer.from(encoded, 'base64url').toString('utf8');
      const record = { text: decoded, incomplete: unavailable || oversized };
      (part.mimeType === 'text/plain' ? plain : html).push(record);
    }
    for (const child of part?.parts || []) visit(child);
  };
  visit(message.payload);
  // MIME alternatives represent the same message. A complete plain-text version
  // remains usable even when its decorative HTML alternative exceeds the limit.
  const selected = plain.length ? plain : html;
  const htmlText = (value) => value.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'");
  const body = selected.map((part) => plain.length ? part.text : htmlText(part.text)).join('\n').replace(/\s+/g, ' ').trim();
  const incomplete = structureIncomplete || !selected.length || selected.some((part) => part.incomplete) || body.length > 12000;

  return { headers, subject: headers.subject || "", from: headers.from || "", body: body.slice(0, 12000), incomplete, unread: (message.labelIds || []).includes("UNREAD"), inInbox: (message.labelIds || []).includes("INBOX") };
}
