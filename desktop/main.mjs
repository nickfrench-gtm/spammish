import { app, BrowserWindow, ipcMain, dialog, Menu, nativeImage, net, powerMonitor, protocol, safeStorage, session, shell, Tray } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { Traction } from '../lib/traction.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readDesktopClient, importDesktopClient } from '../lib/desktop-client-config.mjs';
import { DesktopAccounts } from '../lib/desktop-accounts.mjs';
import { DesktopAccountsStore } from '../lib/desktop-store.mjs';
import { beginDesktopOAuth } from '../lib/desktop-oauth.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const renderer = join(directory, 'ui');
const origin = 'spammish://app/';
protocol.registerSchemesAsPrivileged([{ scheme: 'spammish', privileges: { standard: true, secure: true } }]);
app.setName('Spammish');
process.umask(0o077);
let window;
let tray;
let agent;
let client;
let traction;
let oauthAttempt;
let connecting = false;
let quitting = false;
let quitStarted = false;
let interval;
let sweepTimer;
let fatalError;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => showWindow());
  app.on('activate', () => showWindow());
  app.whenReady().then(start).catch(() => { fatalError = 'startup_failed'; if (window) publish(); else app.quit(); });
}

const status = () => ({ ...(agent?.status() || { connected: false, enabled: false, canConnect: Boolean(client), accounts: [] }), connecting, error: fatalError || null, traction: traction?.status() || { choice: 'pending', suppressed: true, available: false } });
function showWindow() { if (window) { window.show(); window.focus(); } }
function publish() {
  clearTimeout(sweepTimer);
  const state = agent?.status();
  if (state?.enabled && state.sweeping && !quitting && !quitStarted) {
    sweepTimer = setTimeout(() => { if (agent) void syncBackground(); }, 2000);
    sweepTimer.unref();
  }
  if (window && !window.isDestroyed()) window.webContents.send('spammish:status', status());
  loginItem(Boolean(state?.enabled));
  updateTray();
}
async function syncBackground() {
  if (!agent) return;
  try {
    await agent.sync();
    if (['secure_storage_unavailable', 'local_storage_full', 'local_storage_error', 'background_interrupted'].includes(fatalError)) {
      fatalError = null;
      publish();
    }
  } catch (error) {
    fatalError = error.message === 'secure_storage_unavailable' ? 'secure_storage_unavailable'
      : error.code === 'ENOSPC' ? 'local_storage_full'
      : ['EIO', 'EACCES', 'EPERM'].includes(error.code) ? 'local_storage_error' : 'background_interrupted';
    publish();
  }
}
let loginEnabled;
function loginItem(enabled) {
  if (app.isPackaged && loginEnabled !== Boolean(enabled)) { app.setLoginItemSettings({ openAtLogin: Boolean(enabled) }); loginEnabled = Boolean(enabled); }
}
async function invoke(action) {
  try { const value = await action(); publish(); return { ok: true, status: status(), ...value }; }
  catch (error) {
    const known = ['oauth_cancelled', 'oauth_timeout', 'operation_cancelled', 'secure_storage_unavailable', 'refresh_token_missing', 'desktop_client_required', 'wrong_gmail_account', 'account_not_found', 'desktop_client_already_configured'];
    return { ok: false, error: known.includes(error.message) ? error.message : error.oauthError === 'invalid_grant' ? 'reconnect_required' : 'connection_interrupted', status: status() };
  }
}
function updateTray() {
  if (!tray) return;
  const state = status();
  tray.setToolTip(`Spammish — ${state.error ? 'Needs attention' : state.enabled ? 'On' : state.connected ? 'Paused' : 'Not connected'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Spammish', click: showWindow },
    ...(state.accounts || []).map((account) => ({ label: account.email, submenu: [{ label: account.enabled ? 'Pause' : 'Turn on', enabled: account.enabled || (!connecting && !fatalError && account.error !== 'reconnect_required'), click: () => { void invoke(async () => { if (account.enabled) await agent.pause(account.id); else { await agent.enable(account.id); void syncBackground(); } }); } }] })),
    { label: 'Pause all accounts', enabled: state.enabled, click: () => { void invoke(() => agent.pauseAll()); } },
    { type: 'separator' },
    { label: 'Quit Spammish', click: () => app.quit() },
  ]));
}
function handler(name, action) {
  ipcMain.handle(`spammish:${name}`, (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== origin || event.senderFrame?.parent) throw new Error('untrusted_sender');
    return action(...args);
  });
}

async function start() {
  const dataDir = app.getPath('userData');
  const suppressed = !app.isPackaged || process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.env.SPAMMISH_TELEMETRY_SUPPRESS === '1' || existsSync(join(dataDir, 'suppress-traction'));
  traction = new Traction({ file: join(dataDir, 'traction.json'), version: JSON.parse(readFileSync(join(directory, '..', 'package.json'), 'utf8')).version, suppressed });
  void traction.ready.then(() => { traction.observe('app_started'); publish(); });
  const config = app.isPackaged ? join(process.resourcesPath, 'google-oauth.json') : join(directory, 'oauth-client.json');
  const localConfig = join(app.getPath('userData'), 'google-oauth.json');
  try { if (existsSync(localConfig)) client = readDesktopClient(localConfig); else if (existsSync(config)) client = readDesktopClient(config); }
  catch { fatalError = 'desktop_client_required'; }
  try {
    const store = new DesktopAccountsStore(app.getPath('userData'), safeStorage);
    if (!store.available()) throw new Error('secure_storage_unavailable');
    agent = new DesktopAccounts({ store, client, onChange: publish, onMilestone: name => traction.observe(name) });
  } catch { fatalError = 'secure_storage_unavailable'; }

  protocol.handle('spammish', (request) => {
    const url = new URL(request.url);
    const allowed = { '/': 'index.html', '/style.css': 'style.css', '/renderer.js': 'renderer.js', '/progress.mjs': 'progress.mjs', '/abyss.png': 'abyss.png', '/explain.mjs': '../lib/explain.mjs', '/review-presentation.mjs': '../lib/review-presentation.mjs' };
    if (url.host !== 'app' || !allowed[url.pathname]) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(['/explain.mjs', '/review-presentation.mjs'].includes(url.pathname) ? join(directory, '..', 'lib', url.pathname.slice(1)) : join(renderer, allowed[url.pathname])).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 780, height: 780, minWidth: 440, minHeight: 550,
    title: 'Spammish', backgroundColor: '#080b10', show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(directory, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== origin) event.preventDefault(); });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.on('close', (event) => { if (!quitting) { event.preventDefault(); window.hide(); } });
  const icon = nativeImage.createFromPath(join(directory, 'assets', 'tray.png'));
  icon.setTemplateImage(process.platform === 'darwin');
  tray = new Tray(icon);
  tray.on('click', showWindow);
  updateTray();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Spammish', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { label: 'Quit Spammish', accelerator: 'CommandOrControl+Q', click: () => app.quit() }] },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]));
  handler('status', () => status());
  handler('tractionChoice', async choice => { const ok = await traction.choose(choice); publish(); return { ok, status: status() }; });
  handler('connect', (id) => invoke(async () => {
    if (id != null) agent?.get(id);
    if (connecting) throw new Error('operation_cancelled');
    if (!client) {
      if (!agent || fatalError && fatalError !== 'desktop_client_required') throw new Error('secure_storage_unavailable');
      // Do not switch the OAuth client under already-connected accounts.
      if (agent.records.size) throw new Error('desktop_client_required');
      const selected = await dialog.showOpenDialog(window, { title: 'Set up Gmail — choose your Google Desktop OAuth JSON', buttonLabel: 'Use configuration', properties: ['openFile'], filters: [{ name: 'Google OAuth configuration', extensions: ['json'] }] });
      if (selected.canceled || !selected.filePaths.length) throw new Error('operation_cancelled');
      client = importDesktopClient(selected.filePaths[0], app.getPath('userData'));
      agent.client = client;
      if (fatalError === 'desktop_client_required') fatalError = null;
    }
    if (!agent || fatalError) throw new Error('secure_storage_unavailable');
    connecting = true; publish();
    try {
      oauthAttempt = await beginDesktopOAuth({ client, openBrowser: (url) => shell.openExternal(url) });
      const tokens = await oauthAttempt.result;
      const result = await agent.connect(tokens, id);
      // Begin cleanup immediately without keeping the connection screen waiting.
      void syncBackground();
      return result;
    } finally { connecting = false; oauthAttempt = null; publish(); }
  }));
  handler('setupGuide', () => shell.openExternal('https://github.com/nickfrench-gtm/spammish/blob/main/docs/desktop-install.md'));
  handler('cancel', () => invoke(async () => { oauthAttempt?.cancel(); await agent?.cancelConnection(); }));
  handler('enable', (id) => invoke(async () => { await agent.enable(id); void syncBackground(); }));
  handler('pause', (id) => invoke(async () => { await agent.pause(id); }));
  handler('review', () => invoke(async () => {
    const moves = [];
    for (const account of agent.status().accounts) {
      for (const row of await agent.get(account.id).recentActivity()) moves.push({ ...row, accountId: account.id, accountEmail: account.email });
    }
    return { moves: moves.sort((a,b) => b.time - a.time).slice(0,20) };
  }));
  handler('explainMessage', (id, messageId) => invoke(async () => ({ decision: await agent.get(id).explain(messageId) })));
  handler('abyssMessage', (id, messageId) => invoke(async () => { await agent.get(id).abyssMessage(messageId); return { corrected: true }; }));
  handler('rescueMessage', (id, messageId) => invoke(async () => { await agent.get(id).rescueMessage(messageId); return { rescued: true }; }));
  handler('retry', () => invoke(async () => { await agent.sync(); }));
  handler('disconnect', (id) => invoke(async () => { const result = await agent.disconnect(id); return { revokePending: result.revokePending || false }; }));
  handler('abyss', (id) => invoke(async () => {
    const email = agent?.get(id).status().email;
    if (!email) return;
    await shell.openExternal(`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#label/The+Abyss`);
  }));
  await window.loadURL(origin);
  if (!app.isPackaged || !app.getLoginItemSettings().wasOpenedAtLogin) showWindow();
  interval = setInterval(() => { if (agent) void syncBackground(); }, 20_000);
  interval.unref();
  if (agent) void syncBackground();
  powerMonitor.on('resume', () => { if (agent) void syncBackground(); });
  powerMonitor.on('suspend', () => { if (agent) void agent.stop().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); }); });
}

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  if (quitStarted) return;
  quitStarted = true;
  traction?.close();
  clearInterval(interval);
  clearTimeout(sweepTimer);
  oauthAttempt?.cancel();
  Promise.resolve(agent?.stop()).finally(() => { quitting = true; app.quit(); });
});
