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

test('multi-account storage migrates the legacy connection without changing pause state or progress',async()=>{
 const { DesktopAccountsStore }=await import('./desktop-store.mjs');
 const directory=mkdtempSync(join(tmpdir(),'spammish-migration-'));
 try{
  const old={email:'reader@example.test',refreshToken:'legacy-fixture-refresh',historyId:'123',labelId:'reader-abyss',enabled:false,initialSweep:{phase:'processing',ids:['fixture-message'],index:0,pageToken:null}};
  new DesktopStore(directory,secure).save(old);
  const multi=new DesktopAccountsStore(directory,secure);const accounts=multi.load();
  assert.deepEqual(accounts,[{id:'legacy',...old}]);assert.equal(new DesktopStore(directory,secure).load(),null);
  accounts.push({id:'2b2d74dd-f056-41bf-a331-e5ef82c89a1b',...old,email:'second@example.test',refreshToken:'second-fixture-refresh',labelId:'second-abyss',enabled:true});
  multi.save(accounts);assert.deepEqual(new DesktopAccountsStore(directory,secure).load(),accounts);
  const serialized=readFileSync(join(directory,'accounts.json'),'utf8');assert.equal(serialized.includes('fixture-refresh'),false);
  if(process.platform!=='win32')assert.equal(statSync(join(directory,'accounts.json')).mode&0o777,0o600);
  multi.save(accounts.slice(1));assert.equal(multi.load()[0].email,'second@example.test');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
