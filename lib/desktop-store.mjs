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

/** Versioned multi-account storage. Each refresh token remains OS-encrypted. */
export class DesktopAccountsStore {
  constructor(directory, safeStorage) {
    this.legacy = new DesktopStore(directory, safeStorage);
    this.safeStorage = safeStorage;
    this.path = join(directory, 'accounts.json');
  }
  available() { return this.legacy.available(); }
  load() {
    if (!this.available()) throw new Error('secure_storage_unavailable');
    if (!existsSync(this.path)) {
      const old = this.legacy.load();
      if (!old) return [];
      // Write the new encrypted format before removing the old credential file.
      const migrated = [{ id: 'legacy', ...old }];
      this.save(migrated);
      this.legacy.clear();
      return migrated;
    }
    const stored = JSON.parse(readFileSync(this.path, 'utf8'));
    if (stored.version !== 1 || !Array.isArray(stored.accounts)) throw new Error('stored_connection_invalid');
    const ids = new Set();
    const emails = new Set();
    const accounts = stored.accounts.map(({ credential, ...metadata }) => {
      if (!/^(legacy|[0-9a-f-]{36})$/.test(metadata.id) || ids.has(metadata.id) || typeof metadata.email !== 'string' || emails.has(metadata.email.toLowerCase())) throw new Error('stored_connection_invalid');
      const refreshToken = this.safeStorage.decryptString(Buffer.from(credential, 'base64'));
      if (!refreshToken || !metadata.historyId || !metadata.labelId) throw new Error('stored_connection_invalid');
      ids.add(metadata.id); emails.add(metadata.email.toLowerCase());
      return { ...metadata, refreshToken };
    });
    // Finish a migration interrupted after the atomic new-format write.
    this.legacy.clear();
    return accounts;
  }
  save(accounts) {
    if (!this.available()) throw new Error('secure_storage_unavailable');
    const encrypted = accounts.map(({ refreshToken, ...metadata }) => ({ ...metadata, credential: this.safeStorage.encryptString(refreshToken).toString('base64') }));
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, accounts: encrypted }), { mode: 0o600, flush: true });
    renameSync(temporary, this.path);
  }
}
