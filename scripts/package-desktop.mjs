import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { installedClient } from '../lib/desktop-oauth.mjs';
const preview = process.argv.includes('--preview');
const directory = resolve(import.meta.dirname, '..');
const config = resolve(process.env.SPAMMISH_CLIENT_CONFIG || `${directory}/desktop/oauth-client.json`);
if (existsSync(config)) installedClient(JSON.parse(readFileSync(config, 'utf8')));
if (!preview) {
 if (!existsSync(config)) throw new Error('Release blocked: supply the maintainer-owned Desktop OAuth client.');
 if (process.env.SPAMMISH_GOOGLE_APPROVED !== 'yes') throw new Error('Release blocked: confirm Google approval and successful live Gmail acceptance testing first.');
 const identities = spawnSync('security', ['find-identity','-v','-p','codesigning'], {encoding:'utf8'});
 if (!identities.stdout?.includes('Developer ID Application')) throw new Error('Release blocked: a Developer ID Application signing identity is required.');
 const passwordAuth = process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID;
 const apiAuth = process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER;
 if (!passwordAuth && !apiAuth) throw new Error('Release blocked: Apple notarization credentials are required.');
}
const architecture = process.argv.includes('--universal') ? '--universal' : process.arch === 'arm64' ? '--arm64' : '--x64';
const result = spawnSync(process.execPath, [`${directory}/node_modules/electron-builder/cli.js`, '--mac', 'dmg', architecture, '--config', `${directory}/electron-builder.cjs`], {
 cwd: directory, stdio: 'inherit', env: { ...process.env, SPAMMISH_PREVIEW: preview ? '1' : '0', ...(preview ? { CSC_IDENTITY_AUTO_DISCOVERY: 'false' } : {}) },
});
process.exit(result.status || (result.error ? 1 : 0));
