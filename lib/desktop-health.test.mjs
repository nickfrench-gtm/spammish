import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the shipped renderer's gate without an Electron or Gmail connection.
test('Pause and recovery-folder access remain available during a global error', () => {
 const source=readFileSync(new URL('../desktop/ui/renderer.js',import.meta.url),'utf8');
 const gate=source.match(/const blocked = (.*);/)[1];
 const context={state:{error:'secure_storage_unavailable',connecting:false},busyAccounts:new Set(),connectingBusy:false};
 const blocked=runInNewContext(`(${gate})`,context);
 assert.equal(blocked('pause','fixture'),false);
 assert.equal(blocked('abyss','fixture'),false);
 assert.equal(blocked('enable','fixture'),true);
 context.state.connecting=true;
 assert.equal(blocked('pause','fixture'),false);
 context.busyAccounts.add('fixture');
 assert.equal(blocked('pause','fixture'),true);
});

test('background recovery clears a stale error and disk failures receive the right message code', async () => {
 const source=readFileSync(new URL('../desktop/main.mjs',import.meta.url),'utf8');
 const implementation=source.slice(source.indexOf('async function syncBackground()'),source.indexOf('let loginEnabled;'));
 let fail=true,published=0;
 const context={agent:{sync:async()=>{if(fail)throw Object.assign(new Error('write failed'),{code:'ENOSPC'});}},fatalError:null,publish:()=>{published++;}};
 runInNewContext(`${implementation}\nthis.run=syncBackground;`,context);
 await context.run();assert.equal(context.fatalError,'local_storage_full');
 fail=false;await context.run();assert.equal(context.fatalError,null);assert.equal(published,2);
 context.fatalError='startup_failed';await context.run();assert.equal(context.fatalError,'startup_failed');
});
