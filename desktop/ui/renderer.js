const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries(['status', 'email', 'instruction', 'primary', 'cancel', 'notice', 'secondary', 'abyss', 'disconnect', 'background'].map((id) => [id, byId(id)]));
let state;
let busy = false;
let notice = '';
const errors = {
  oauth_cancelled: 'Connection cancelled. You can try again whenever you’re ready.',
  oauth_timeout: 'Google sign-in timed out. Click Connect Gmail to try again.',
  operation_cancelled: 'The operation was cancelled.',
  desktop_client_required: 'Gmail connection isn’t available in this preview.',
  secure_storage_unavailable: 'Secure storage is unavailable. Unlock your Mac and reopen Spammish.',
  refresh_token_missing: 'Google could not keep this connection. Reconnect Gmail and approve access.',
  reconnect_required: 'Google access has expired or been revoked. Reconnect Gmail to continue.',
  history_expired: 'Spammish was offline too long. Existing mail was left untouched. Turn it on to watch new mail.',
  connection_interrupted: 'Gmail is temporarily unreachable. Spammish will retry while it’s on.',
};
function render() {
  if (!state) return;
  const error = state.error;
  ui.status.textContent = state.connecting ? 'Connecting' : error ? 'Needs attention' : state.enabled ? 'On' : state.connected ? 'Paused' : 'Not connected';
  ui.status.dataset.on = String(state.enabled && !error);
  ui.email.hidden = !state.connected;
  ui.email.textContent = state.email || '';
  ui.instruction.textContent = state.connecting ? 'Finish connecting in your browser.' : !state.canConnect ? 'Gmail connection isn’t available in this preview.' : state.enabled ? 'Watching new mail. You can close this window.' : state.connected ? 'Turn it on to watch new mail. Existing inbox mail stays untouched.' : 'Connect Gmail, then turn Spammish on.';
  ui.primary.textContent = busy ? state.connecting ? 'Waiting for Google…' : 'Working…' : !state.connected || error === 'reconnect_required' ? 'Connect Gmail' : state.enabled ? 'Pause Spammish' : 'Turn on Spammish';
  ui.primary.disabled = busy || state.connecting || !state.canConnect || error === 'secure_storage_unavailable';
  ui.cancel.hidden = !state.connecting;
  ui.notice.textContent = notice || errors[error] || '';
  ui.notice.hidden = !ui.notice.textContent;
  ui.secondary.hidden = !state.connected;
  ui.disconnect.disabled = busy || state.connecting;
  ui.background.textContent = state.enabled ? 'Runs quietly while your Mac is awake. Starts with your Mac while enabled.' : 'No AI subscription. Classification stays on this Mac.';
}
async function action(name) {
  if (busy) return;
  busy = true; notice = ''; render();
  try {
    const result = await window.spammish[name]();
    if (result.status) state = result.status;
    if (!result.ok) notice = errors[result.error] || 'Something interrupted the connection. Please try again.';
    if (result.revokePending) notice = 'Local connection removed. Google was unreachable; you can also revoke Spammish in your Google Account.';
  } catch { notice = 'Spammish couldn’t finish that action. Reopen the app and try again.'; }
  finally { busy = false; render(); }
}
ui.primary.addEventListener('click', () => { void action(!state.connected || state.error === 'reconnect_required' ? 'connect' : state.enabled ? 'pause' : 'enable'); });
ui.cancel.addEventListener('click', () => { void window.spammish.cancel(); });
ui.disconnect.addEventListener('click', () => { void action('disconnect'); });
ui.abyss.addEventListener('click', () => { void action('abyss'); });
window.spammish.onStatus((next) => { state = next; render(); });
window.spammish.status().then((next) => { state = next; render(); });
