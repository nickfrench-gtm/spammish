import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Electron's safeStorage uses the OS credential store. No manually managed encryption key. */
export class DesktopStore {
  constructor(directory, safeStorage) {
    this.directory = directory;
    this.safeStorage = safeStorage;
    this.path = join(directory, 'account.json');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  available() {
    return this.safeStorage.isEncryptionAvailable() && this.safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  }
  load() {
    if (!existsSync(this.path)) return null;
    if (!this.available()) throw new Error('secure_storage_unavailable');
    const stored = JSON.parse(readFileSync(this.path, 'utf8'));
    const refreshToken = this.safeStorage.decryptString(Buffer.from(stored.credential, 'base64'));
    if (!refreshToken || !stored.email || !stored.historyId || !stored.labelId) throw new Error('stored_connection_invalid');
    const { credential, ...metadata } = stored;
    return { ...metadata, refreshToken };
  }
  save(account) {
    if (!account) { this.clear(); return; }
    if (!this.available()) throw new Error('secure_storage_unavailable');
    const { refreshToken, ...metadata } = account;
    const credential = this.safeStorage.encryptString(refreshToken).toString('base64');
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify({ ...metadata, credential }), { mode: 0o600 });
    renameSync(temporary, this.path);
  }
  clear() {
    for (const file of [this.path, `${this.path}.tmp`]) if (existsSync(file)) unlinkSync(file);
  }
}
