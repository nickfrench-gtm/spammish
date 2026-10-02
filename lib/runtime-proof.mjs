import { createHmac } from 'node:crypto';
import { realpathSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// A challenge response binds doctor to this checkout, vault, client and state file.
// Only the proof is public; paths, client configuration and the key are never returned.
export function runtimeProof(config, challenge, sourceRoot) {
  if (!/^[a-f0-9]{64}$/.test(challenge || '')) return null;
  const key = Buffer.from(config.SPAMMISH_TOKEN_VAULT_KEY || '', 'base64url');
  if (key.length !== 32) return null;
  const data = resolve(config.SPAMMISH_DATA_FILE || './data/spammish.db');
  const identity = [realpathSync(sourceRoot), existsSync(data) ? realpathSync(data) : data,
    config.GOOGLE_CLIENT_ID || '', config.GOOGLE_CLIENT_SECRET || '',
    config.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${config.PORT || 8080}/auth/callback`];
  return createHmac('sha256', key).update(JSON.stringify([challenge, ...identity])).digest('hex');
}
