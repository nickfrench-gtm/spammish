import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { googleTokenRequest } from './gmail-agent.mjs';

export function installedClient(document) {
  const client = document?.installed;
  if (!client || document.web || !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(client.client_id || '')) {
    throw new Error('desktop_client_required');
  }
  return { clientId: client.client_id, clientSecret: client.client_secret || '' };
}

/** Google's installed-app flow: external browser, short-lived loopback listener, state and PKCE. */
export async function beginDesktopOAuth({ client, openBrowser, exchange = googleTokenRequest, timeoutMs = 300_000 }) {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  let resolveResult;
  let rejectResult;
  let consumed = false;
  let timer;
  const result = new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  result.catch(() => {});
  const server = createServer();
  const finish = (error, tokens) => {
    clearTimeout(timer);
    server.close();
    if (error) rejectResult(error);
    else resolveResult(tokens);
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const redirectUri = `http://127.0.0.1:${server.address().port}/oauth/callback`;
  server.on('request', async (req, res) => {
    const url = new URL(req.url, redirectUri);
    const respond = (status, text) => {
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' });
      res.end(text);
    };
    if (req.method !== 'GET' || req.headers.host !== new URL(redirectUri).host || url.pathname !== '/oauth/callback') { respond(404, 'Not found.'); return; }
    if (url.searchParams.get('state') !== state) { respond(400, 'Authorization state did not match. Return to Spammish and try again.'); return; }
    if (consumed) { respond(410, 'This authorization attempt has already finished.'); return; }
    consumed = true;
    if (url.searchParams.get('error') || !url.searchParams.get('code')) {
      respond(400, 'Gmail connection was cancelled. Return to Spammish.');
      finish(new Error('oauth_cancelled')); return;
    }
    try {
      const tokens = await exchange({
        code: url.searchParams.get('code'), code_verifier: verifier,
        client_id: client.clientId,
        ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      });
      respond(200, 'Google authorization is complete. Return to Spammish to finish connecting.');
      finish(null, tokens);
    } catch (error) {
      respond(400, 'Google authorization could not finish. Return to Spammish and try again.');
      finish(error);
    }
  });
  server.on('error', (error) => finish(error));
  timer = setTimeout(() => { consumed = true; finish(new Error('oauth_timeout')); }, timeoutMs);
  timer.unref();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: client.clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.modify', access_type: 'offline',
    prompt: 'select_account consent', state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  try { await openBrowser(url.toString()); }
  catch (error) { finish(error); }
  return { result, cancel: () => { consumed = true; finish(new Error('oauth_cancelled')); } };
}
