import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { HeadlessStore } from './headless-store.mjs';
test('headless store encrypts all account state and preserves the retired counter',()=>{
 const dir=mkdtempSync(join(tmpdir(),'spammish-headless-'));const path=join(dir,'test.db'),key=randomBytes(32);
 const account={id:'fixture',email:'reader@example.test',refreshToken:'fixture-refresh',historyId:'100',labelId:'Label_fixture',enabled:false,movedCount:4};
 try{const store=new HeadlessStore(path,key);store.save([account],{retiredMovedCount:3});store.close();
 const bytes=readFileSync(path).toString('latin1');assert.equal(bytes.includes(account.refreshToken),false);assert.equal(bytes.includes(account.email),false);
 const restored=new HeadlessStore(path,key);assert.deepEqual(restored.load(),[account]);assert.equal(restored.retiredMovedCount,3);restored.close();
 assert.throws(()=>new HeadlessStore(path,Buffer.from('short')),/vault_key_required/);
 const wrong=new HeadlessStore(path,randomBytes(32));assert.throws(()=>wrong.load());wrong.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
