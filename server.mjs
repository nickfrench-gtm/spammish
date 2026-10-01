import { createServer } from "node:http";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { classifyForAbyss } from "./lib/spammish-policy.mjs";
import { createLabel, extractMessage, fullMessage, history, labels, messageMetadata, moveToAbyss, profile, googleTokenRequest } from "./lib/gmail-agent.mjs";

const port = Number(process.env.PORT || 8080);
const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/auth/callback`;
const key = Buffer.from(process.env.SPAMMISH_TOKEN_VAULT_KEY || "", "base64url");
if (key.length !== 32) throw new Error("SPAMMISH_TOKEN_VAULT_KEY must decode to exactly 32 bytes");
const dbPath = resolve(process.env.SPAMMISH_DATA_FILE || "./data/spammish.db");
process.umask(0o077);
mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT, token TEXT, iv TEXT, tag TEXT, history_id TEXT, label_id TEXT, enabled INTEGER NOT NULL DEFAULT 0, last_error TEXT, moved INTEGER NOT NULL DEFAULT 0);");
const get = () => db.prepare("SELECT * FROM settings WHERE id=1").get() || null;
const save = (fields) => {
  const current = get() || { email: null, token: null, iv: null, tag: null, history_id: null, label_id: null, enabled: 0, last_error: null, moved: 0 };
  const next = { ...current, ...fields };
  db.prepare("INSERT INTO settings(id,email,token,iv,tag,history_id,label_id,enabled,last_error,moved) VALUES(1,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,token=excluded.token,iv=excluded.iv,tag=excluded.tag,history_id=excluded.history_id,label_id=excluded.label_id,enabled=excluded.enabled,last_error=excluded.last_error,moved=excluded.moved")
    .run(next.email, next.token, next.iv, next.tag, next.history_id, next.label_id, next.enabled, next.last_error, next.moved);
  return next;
};
function encrypt(secret) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); const token = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]); return { token: token.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") }; }
function decrypt(row) { const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64url")); decipher.setAuthTag(Buffer.from(row.tag, "base64url")); return Buffer.concat([decipher.update(Buffer.from(row.token, "base64url")), decipher.final()]).toString("utf8"); }
const states = new Map();
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((s) => { const i = s.indexOf("="); return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; }));
const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
const page = (message = "") => {
  const account = get();
  const status = account?.email ? `Connected: ${escapeHtml(account.email)} · ${account.enabled ? "On" : "Paused"} · ${account.moved} moved${account.last_error ? ` · ${escapeHtml(account.last_error)}` : ""}` : "No Gmail account connected";
  const action = account?.email ? `<form method="post" action="/toggle"><button>${account.enabled ? "Pause Spammish" : "Enable Spammish"}</button></form><form method="post" action="/disconnect"><button class="secondary">Disconnect Gmail</button></form>` : `<a class="button" href="/auth/connect">Connect Gmail</a>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spammish</title><style>body{margin:0;background:#f7f5ef;color:#25231f;font:16px/1.55 system-ui,sans-serif}.wrap{max-width:690px;margin:12vh auto;padding:28px}h1{font:400 clamp(42px,8vw,68px)/1 Georgia,serif;letter-spacing:-.05em;margin:0 0 20px}p{max-width:55ch;color:#625f58}.card{margin-top:38px;padding:22px;border:1px solid #d8d2c7;background:#fffdf8}button,.button{display:inline-block;padding:11px 15px;margin:10px 10px 0 0;background:#25231f;color:white;border:0;border-radius:4px;text-decoration:none;font:inherit;cursor:pointer}.secondary{background:transparent;color:#25231f;border:1px solid #aaa}.note{font-size:13px;color:#625f58}.status{font-weight:650}.flash{color:#8d3927}</style><main class="wrap"><p>SPAMMISH</p><h1>Never see another B2B cold email.</h1><p>Spammish checks incoming mail with deterministic local rules. High-confidence cold sales and obvious spam move to Gmail’s recoverable <b>The Abyss</b> label. Uncertain mail stays in your inbox.</p><section class="card"><div class="status">${status}</div><div>${action}</div>${message ? `<p class="flash">${escapeHtml(message)}</p>` : ""}</section><p class="note">Spammish does not send, reply, click links, unsubscribe, delete, or mark messages read. It reads message content locally for classification and leaves unread state unchanged. Gmail may show new mail briefly before the next check.</p><p class="note">Moved mail remains available under The Abyss in Gmail. This local-first open-source agent uses no paid AI API.</p></main></html>`;
};
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function send(res, status, body, extra = {}) { res.writeHead(status, { ...headers, ...extra }); res.end(body); }
function redirect(res, path, extra = {}) { res.writeHead(303, { location: path, "cache-control": "no-store", ...extra }); res.end(); }

async function accessToken(row) {
  const token = await googleTokenRequest({ refresh_token: decrypt(row), client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
  return token.access_token;
}
let busy = false;
async function sync() {
  let row = get(); if (!row?.enabled || busy) return; busy = true;
  try {
    const token = await accessToken(row);
    let cursor = row.history_id;
    let nextCursor = cursor;
    let pages = 0;
    const ids = new Set();
    let pageToken;
    while (cursor && pages++ < 10) {
      const result = await history(token, cursor, pageToken);
      nextCursor = result.historyId || nextCursor;
      for (const entry of result.history || []) for (const added of entry.messagesAdded || []) {
        const item = added.message;
        if (item.id) ids.add(item.id);
      }
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    if (pageToken) throw new Error("gmail_history_backlog_exceeded");
    for (const id of ids) {
      const metadata = await messageMetadata(token, id);
      if (!(metadata.labelIds || []).includes("INBOX")) continue;
      const msg = extractMessage(await fullMessage(token, id));
      if (!msg.inInbox) continue;
      const result = classifyForAbyss(msg);
      if (result.divert) {
        await moveToAbyss(token, id, row.label_id);
        row = save({ moved: row.moved + 1 });
      }
    }
    if (nextCursor) save({ history_id: nextCursor, last_error: null });
  } catch (error) {
    if (/gmail_api_404/.test(error.message)) {
      try { const token = await accessToken(row); const current = await profile(token); save({ history_id: current.historyId, last_error: "Gmail history cursor refreshed; older mail was left untouched." }); }
      catch (nested) { save({ last_error: nested.message }); }
    } else save({ last_error: error.message });
  } finally { busy = false; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (req.method === "GET" && url.pathname === "/") { send(res, 200, page(url.searchParams.get("message") || "")); return; }
  if (req.method === "GET" && url.pathname === "/auth/connect") {
    if (!clientId || !clientSecret) { redirect(res, "/?message=Set+Google+OAuth+credentials+in+.env"); return; }
    const state = randomBytes(24).toString("base64url"); states.set(state, Date.now() + 600000);
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/gmail.modify", access_type: "offline", prompt: "consent", state });
    res.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, "set-cookie": `spammish_oauth=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}` }); res.end(); return;
  }
  if (req.method === "GET" && url.pathname === "/auth/callback") {
    const state = url.searchParams.get("state"); const cookieState = cookies(req).spammish_oauth;
    const stateExpires = state ? states.get(state) : null;
    if (!state || state !== cookieState || !stateExpires || stateExpires < Date.now()) { send(res, 400, page("OAuth state check failed.")); return; }
    states.delete(state);
    try {
      const token = await googleTokenRequest({ code: url.searchParams.get("code"), client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
      if (!token.refresh_token) throw new Error("Google did not return a refresh token. Revoke access and reconnect with consent.");
      const account = await profile(token.access_token);
      const known = await labels(token.access_token);
      const abyss = known.labels?.find((label) => label.name === "The Abyss") || await createLabel(token.access_token);
      const encrypted = encrypt(token.refresh_token);
      save({ email: account.emailAddress, ...encrypted, history_id: account.historyId, label_id: abyss.id, enabled: 0, last_error: null, moved: 0 });
      redirect(res, "/", { "set-cookie": `spammish_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}` });
    } catch (error) { send(res, 400, page(error.message)); }
    return;
  }
  if (req.method === "POST" && (url.pathname === "/toggle" || url.pathname === "/disconnect")) {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) { send(res, 403, page("Request origin rejected.")); return; }
    const row = get();
    if (url.pathname === "/disconnect") { db.exec("DELETE FROM settings WHERE id=1"); redirect(res, "/"); return; }
    if (!row?.email) { redirect(res, "/"); return; }
    if (!row.enabled) {
      try { const token = await accessToken(row); const current = await profile(token); save({ enabled: 1, history_id: current.historyId, last_error: null }); setTimeout(() => { void sync(); }, 0); }
      catch (error) { save({ last_error: error.message }); }
    } else save({ enabled: 0, last_error: null });
    redirect(res, "/"); return;
  }
  send(res, 404, page("Not found."));
});

server.listen(port, "127.0.0.1", () => console.log(`Spammish is listening at http://127.0.0.1:${port}`));
setInterval(() => { void sync(); }, 20_000).unref();
