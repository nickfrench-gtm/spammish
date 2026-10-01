import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The headless runtime uses the same account engine with an encrypted SQLite envelope. */
export class HeadlessStore {
 constructor(path, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('vault_key_required');
  mkdirSync(dirname(path), {recursive:true,mode:0o700});
  this.key=key;this.retiredMovedCount=0;this.db=new DatabaseSync(path);chmodSync(path,0o600);
  this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS account_state (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, iv TEXT NOT NULL, tag TEXT NOT NULL);');
 }
 encrypt(value) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);
  const token=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {token:token.toString('base64url'),iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')};
 }
 decrypt(row, json=true) {
  const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(row.iv,'base64url'));decipher.setAuthTag(Buffer.from(row.tag,'base64url'));
  const text=Buffer.concat([decipher.update(Buffer.from(row.token,'base64url')),decipher.final()]).toString('utf8');
  return json?JSON.parse(text):text;
 }
 load() {
  const row=this.db.prepare('SELECT * FROM account_state WHERE id=1').get();
  if(row){const value=this.decrypt(row);if(value.version!==1||!Array.isArray(value.accounts))throw new Error('stored_connection_invalid');this.retiredMovedCount=value.retiredMovedCount||0;return value.accounts;}
  const legacyTable=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
  if(!legacyTable)return [];
  const old=this.db.prepare('SELECT * FROM settings WHERE id=1').get();if(!old?.email)return [];
  const accounts=[{id:'legacy',email:old.email,refreshToken:this.decrypt(old,false),historyId:old.history_id,labelId:old.label_id,enabled:Boolean(old.enabled),movedCount:old.moved||0,error:null}];
  this.save(accounts);this.db.exec('DELETE FROM settings WHERE id=1');return accounts;
 }
 save(accounts,{retiredMovedCount=this.retiredMovedCount}={}) {
  const row=this.encrypt({version:1,retiredMovedCount,accounts});
  this.db.prepare('INSERT INTO account_state(id,token,iv,tag) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,iv=excluded.iv,tag=excluded.tag').run(row.token,row.iv,row.tag);
  this.retiredMovedCount=retiredMovedCount;
 }
 close(){this.db.close();}
}
