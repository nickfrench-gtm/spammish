import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importDesktopClient, readDesktopClient } from './desktop-client-config.mjs';

test('Desktop client import validates, minimizes, persists privately and refuses replacement', () => {
 const root = mkdtempSync(join(tmpdir(), 'spammish-client-test-'));
 try {
  const source = join(root, 'download.json'), directory = join(root, 'profile');
  const installed = { client_id: '123-test.apps.googleusercontent.com', client_secret: 'synthetic-config' };
  writeFileSync(source, JSON.stringify({ installed, refresh_token: 'must-not-copy', unrelated: 'must-not-copy' }));
  const client = importDesktopClient(source, directory);
  assert.equal(client.clientId, installed.client_id);
  const stored = join(directory, 'google-oauth.json');
  assert.deepEqual(JSON.parse(readFileSync(stored)), { installed });
  assert.equal(statSync(stored).mode & 0o777, 0o600);
  assert.deepEqual(readDesktopClient(stored), client);
  assert.throws(() => importDesktopClient(source, directory), /already_configured/);
  for (const value of ['{broken', JSON.stringify({web:installed}), 'x'.repeat(65537)]) {
   writeFileSync(source, value);
   assert.throws(() => readDesktopClient(source), /desktop_client_required/);
  }
 } finally { rmSync(root, { recursive: true, force: true }); }
});
