import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DesktopStore } from './desktop-store.mjs';
const secure={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString:(s)=>Buffer.from(s).map(b=>b^173),decryptString:(b)=>Buffer.from(b).map(b=>b^173).toString()};

test('only an OS-encrypted credential is persisted; a restart restores it',()=>{
 const directory=mkdtempSync(join(tmpdir(),'spammish-store-'));
 try {
  const store=new DesktopStore(directory,secure);
  const account={email:'reader@example.com',refreshToken:'fixture-refresh-credential',historyId:'100',labelId:'Label_abyss',enabled:true};
  store.save(account);
  const text=readFileSync(join(directory,'account.json'),'utf8');assert.equal(text.includes(account.refreshToken),false);assert.equal(text.includes('body'),false);
  const restarted=new DesktopStore(directory,secure);assert.deepEqual(restarted.load(),account);
  if(process.platform!=='win32')assert.equal(statSync(join(directory,'account.json')).mode&0o777,0o600);
  restarted.clear();assert.equal(restarted.load(),null);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('unencrypted storage backends fail closed',()=>{
 const directory=mkdtempSync(join(tmpdir(),'spammish-store-'));
 try {const store=new DesktopStore(directory,{...secure,getSelectedStorageBackend:()=> 'basic_text'});assert.equal(store.available(),false);assert.throws(()=>store.save({refreshToken:'fixture'}),/secure_storage_unavailable/);}finally{rmSync(directory,{recursive:true,force:true});}
});
