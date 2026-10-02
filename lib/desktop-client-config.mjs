import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installedClient } from './desktop-oauth.mjs';

export function readDesktopClient(path) {
  try {
    if (statSync(path).size > 64 * 1024) throw new Error('desktop_client_required');
    return installedClient(JSON.parse(readFileSync(path, 'utf8')));
  } catch { throw new Error('desktop_client_required'); }
}

// Retain only client configuration, never unrelated JSON fields or user tokens.
export function importDesktopClient(source, directory) {
  const client = readDesktopClient(source);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'google-oauth.json');
  if (existsSync(path)) throw new Error('desktop_client_already_configured');
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify({ installed: { client_id: client.clientId, client_secret: client.clientSecret } }), { mode: 0o600, flag: 'wx' });
  renameSync(temporary, path);
  return client;
}
