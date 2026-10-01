const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const preview = process.env.SPAMMISH_PREVIEW === '1';
const config = resolve(process.env.SPAMMISH_CLIENT_CONFIG || 'desktop/oauth-client.json');
module.exports = {
 appId: 'io.spammish.desktop', productName: 'Spammish', asar: true,
 directories: { output: 'dist' },
 files: ['desktop/main.mjs', 'desktop/preload.cjs', 'desktop/ui/**', 'desktop/assets/**', 'lib/*.mjs', '!lib/*.test.mjs', 'package.json', 'LICENSE'],
 extraResources: existsSync(config) ? [{ from: config, to: 'google-oauth.json' }] : [],
 artifactName: preview ? 'Spammish-${version}-preview-${arch}.${ext}' : 'Spammish-${version}-${arch}.${ext}',
 mac: { target: ['dmg'], category: 'public.app-category.utilities', icon: 'desktop/assets/icon.png', hardenedRuntime: !preview, notarize: !preview, ...(preview ? { identity: null } : {}) },
 dmg: { title: 'Spammish', contents: [{x:145,y:150},{x:415,y:150,type:'link',path:'/Applications'}] },
 publish: null,
};
