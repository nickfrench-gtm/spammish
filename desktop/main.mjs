import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, powerMonitor, protocol, safeStorage, session, shell, Tray } from 'electron';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DesktopAgent } from '../lib/desktop-agent.mjs';
import { DesktopStore } from '../lib/desktop-store.mjs';
import { beginDesktopOAuth, installedClient } from '../lib/desktop-oauth.mjs';

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

const status = () => ({ ...(agent?.status() || { connected: false, enabled: false, canConnect: Boolean(client), email: null, lastCheck: null }), connecting, error: fatalError || agent?.status().error || null });
function showWindow() { if (window) { window.show(); window.focus(); } }
function publish() {
  clearTimeout(sweepTimer);
  const state = agent?.status();
  if (state?.enabled && state.sweeping && !state.error && !quitting && !quitStarted) {
    sweepTimer = setTimeout(() => { if (agent) void agent.sync().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); }); }, 2000);
    sweepTimer.unref();
  }
  if (window && !window.isDestroyed()) window.webContents.send('spammish:status', status());
  updateTray();
}
function loginItem(enabled) {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
}
async function invoke(action) {
  try { const value = await action(); publish(); return { ok: true, status: status(), ...value }; }
  catch (error) {
    const known = ['oauth_cancelled', 'oauth_timeout', 'operation_cancelled', 'secure_storage_unavailable', 'refresh_token_missing', 'desktop_client_required'];
    return { ok: false, error: known.includes(error.message) ? error.message : error.oauthError === 'invalid_grant' ? 'reconnect_required' : 'connection_interrupted', status: status() };
  }
}
function updateTray() {
  if (!tray) return;
  const state = status();
  tray.setToolTip(`Spammish — ${state.error ? 'Needs attention' : state.enabled ? 'On' : state.connected ? 'Paused' : 'Not connected'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Spammish', click: showWindow },
    { label: state.enabled ? 'Pause' : 'Turn on', enabled: state.connected && !connecting && !fatalError, click: () => { void invoke(async () => { if (state.enabled) { await agent.pause(); loginItem(false); } else { await agent.enable(); loginItem(true); void agent.sync(); } }); } },
    { type: 'separator' },
    { label: 'Quit Spammish', click: () => app.quit() },
  ]));
}
function handler(name, action) {
  ipcMain.handle(`spammish:${name}`, (event) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== origin || event.senderFrame?.parent) throw new Error('untrusted_sender');
    return action();
  });
}

async function start() {
  const config = app.isPackaged ? join(process.resourcesPath, 'google-oauth.json') : join(directory, 'oauth-client.json');
  try { if (existsSync(config)) client = installedClient(JSON.parse(readFileSync(config, 'utf8'))); }
  catch { fatalError = 'desktop_client_required'; }
  try {
    const store = new DesktopStore(app.getPath('userData'), safeStorage);
    if (!store.available()) throw new Error('secure_storage_unavailable');
    agent = new DesktopAgent({ store, client, onChange: publish });
  } catch { fatalError = 'secure_storage_unavailable'; }

  protocol.handle('spammish', (request) => {
    const url = new URL(request.url);
    const allowed = { '/': 'index.html', '/style.css': 'style.css', '/renderer.js': 'renderer.js' };
    if (url.host !== 'app' || !allowed[url.pathname]) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(join(renderer, allowed[url.pathname])).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 540, height: 620, minWidth: 440, minHeight: 550,
    title: 'Spammish', backgroundColor: '#f7f5ef', show: false,
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
  handler('connect', () => invoke(async () => {
    if (connecting) throw new Error('operation_cancelled');
    if (!client) throw new Error('desktop_client_required');
    if (!agent || fatalError) throw new Error('secure_storage_unavailable');
    connecting = true; publish();
    try {
      oauthAttempt = await beginDesktopOAuth({ client, openBrowser: (url) => shell.openExternal(url) });
      const tokens = await oauthAttempt.result;
      await agent.connect(tokens);
      loginItem(false);
    } finally { connecting = false; oauthAttempt = null; publish(); }
  }));
  handler('cancel', () => { oauthAttempt?.cancel(); return { ok: true }; });
  handler('enable', () => invoke(async () => { await agent.enable(); loginItem(true); void agent.sync(); }));
  handler('pause', () => invoke(async () => { await agent.pause(); loginItem(false); }));
  handler('retry', () => invoke(async () => { await agent.sync(); }));
  handler('disconnect', () => invoke(async () => { oauthAttempt?.cancel(); const result = await agent.disconnect(); loginItem(false); return { revokePending: result.revokePending || false }; }));
  handler('abyss', () => invoke(async () => {
    const email = agent?.status().email;
    if (!email) return;
    await shell.openExternal(`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#label/The+Abyss`);
  }));
  await window.loadURL(origin);
  if (!app.isPackaged || !app.getLoginItemSettings().wasOpenedAtLogin) showWindow();
  interval = setInterval(() => { if (agent) void agent.sync().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); }); }, 20_000);
  interval.unref();
  if (agent) void agent.sync().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); });
  powerMonitor.on('resume', () => { if (agent) void agent.sync().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); }); });
  powerMonitor.on('suspend', () => { if (agent) void agent.stop().catch(() => { fatalError = 'secure_storage_unavailable'; publish(); }); });
}

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  if (quitStarted) return;
  quitStarted = true;
  clearInterval(interval);
  clearTimeout(sweepTimer);
  oauthAttempt?.cancel();
  Promise.resolve(agent?.stop()).finally(() => { quitting = true; app.quit(); });
});
