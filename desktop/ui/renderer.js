import { explainDecision } from './explain.mjs';
import { cleanupInstruction, quotaNotice, isQuotaWait } from './progress.mjs';
const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries(['status', 'moved', 'accounts', 'instruction', 'connect', 'cancel', 'notice', 'background'].map((id) => [id, byId(id)]));
let state;
let connectingBusy = false;
const busyAccounts = new Set();
const blocked = (name, id) => (Boolean(state.error) && name !== 'pause' && name !== 'abyss') || busyAccounts.has(id) || ((state.connecting || connectingBusy) && name !== 'pause');
let notice = '';
const errors = {
  oauth_cancelled: 'Connection cancelled. You can try again whenever you’re ready.',
  oauth_timeout: 'Google sign-in timed out. Connect Gmail to try again.',
  operation_cancelled: 'The operation was cancelled.',
  desktop_client_required: 'Gmail connection isn’t available in this preview.',
  secure_storage_unavailable: 'Secure storage is unavailable. Unlock your Mac and reopen Spammish.',
  refresh_token_missing: 'Google could not keep this connection. Reconnect Gmail and approve access.',
  reconnect_required: 'Google access has expired or been revoked. Reconnect this Gmail to continue.',
  history_expired: 'Spammish was offline too long. Existing mail was left untouched. Turn this account on to watch new mail.',
  connection_interrupted: 'The last Gmail check failed. Spammish will retry while this account is on.',
  local_storage_full: 'Your Mac is out of disk space. Free some space so Spammish can save its progress. Pause remains available.',
  local_storage_error: 'Spammish could not save its progress on this Mac. Check disk access or reopen the app. Pause remains available.',
  background_interrupted: 'A background check failed. Spammish will retry; you can pause it at any time.',
  wrong_gmail_account: 'Choose the same Gmail account when reconnecting. Use Add Gmail account for a different address.',
  account_not_found: 'This Gmail connection is no longer available. Reopen Spammish to refresh.',
};
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function control(label, name, id, className = 'text-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.dataset.operation = name;
  button.disabled = blocked(name, id);
  button.addEventListener('click', () => { void action(name, id); });
  return button;
}
function render() {
  if (!state) return;
  const accounts = state.accounts || [];
  const moved = Number.isSafeInteger(state.movedCount) ? state.movedCount : 0;
  ui.moved.textContent = `${moved.toLocaleString()} ${moved === 1 ? 'email' : 'emails'} sent to The Abyss`;
  ui.moved.title = 'Confirmed moves since this counter was introduced. Includes disconnected accounts; older moves are not guessed.';
  const enabled = accounts.filter((account) => account.enabled).length;
  ui.status.textContent = state.connecting ? 'Connecting' : state.error ? 'Needs attention' : enabled ? `${enabled} ${enabled === 1 ? 'account' : 'accounts'} on` : accounts.length ? 'Paused' : 'Not connected';
  ui.status.dataset.on = String(enabled > 0 && !state.error);
  // Reconcile keyed rows so background checks do not steal keyboard focus.
  const present = new Set(accounts.map((account) => account.id));
  for (const row of [...ui.accounts.children]) if (!present.has(row.dataset.id)) row.remove();
  for (const account of accounts) {
    let row = [...ui.accounts.children].find((candidate) => candidate.dataset.id === account.id);
    if (!row) {
      row = element('section', 'account'); row.dataset.id = account.id;
      row.setAttribute('aria-label', `Gmail account ${account.email}`);
      const heading = element('div', 'account-heading');
      const identity = element('div', 'identity');
      identity.append(element('p', 'email', account.email), element('p', 'account-state'));
      heading.append(identity, control('Turn on', 'enable', account.id, 'account-toggle'));
      const instruction = element('p', 'account-instruction');
      const error = element('p', 'notice'); error.setAttribute('role', 'status');
      const actions = element('div', 'secondary-actions');
      actions.append(control('Open The Abyss', 'abyss', account.id), control('Disconnect', 'disconnect', account.id));
      row.append(heading, instruction, error, actions); ui.accounts.append(row);
    }
    row.querySelector('.account-state').textContent = isQuotaWait(account) ? 'Waiting for Gmail' : account.error ? 'Needs attention' : account.enabled ? 'On' : 'Paused';
    row.querySelector('.account-state').dataset.on = String(account.enabled && !account.error);
    row.querySelector('.account-instruction').textContent = cleanupInstruction(account);
    const message = row.querySelector('.notice'); message.textContent = isQuotaWait(account)
      ? quotaNotice(account)
      : account.error === 'connection_interrupted' && ['forbidden', 'domainPolicy', 'insufficientPermissions'].includes(account.failureReason)
        ? 'Google denied this Gmail request. Check the app’s Gmail access and your account’s Google policy.'
        : errors[account.error] || ''; message.hidden = !message.textContent;
    const oldToggle = row.querySelector('.account-toggle');
    const actionName = account.error === 'reconnect_required' ? 'connect' : account.enabled ? 'pause' : 'enable';
    // Replace only when the action changes; ongoing sync keeps focused controls intact.
    if (oldToggle.dataset.action !== actionName) {
      const replacement = control(actionName === 'connect' ? 'Reconnect' : actionName === 'pause' ? 'Pause' : 'Turn on', actionName, account.id, 'account-toggle');
      replacement.dataset.action = actionName;
      replacement.setAttribute('aria-label', `${replacement.textContent} for ${account.email}`);
      const focused = document.activeElement === oldToggle;
      oldToggle.replaceWith(replacement); if (focused) replacement.focus();
    }
    for (const button of row.querySelectorAll('button')) button.disabled = blocked(button.dataset.operation, account.id);
  }
  ui.instruction.textContent = state.connecting ? 'Finish connecting in your browser. Existing accounts keep their own settings.' : !state.canConnect ? 'Gmail connection isn’t available in this preview.' : accounts.length ? 'Connecting Gmail starts inbox cleanup. Each account has its own Pause control.' : 'Connecting Gmail starts inbox cleanup automatically.';
  ui.connect.textContent = state.connecting ? 'Waiting for Google…' : accounts.length ? 'Add Gmail account' : 'Connect Gmail';
  ui.connect.classList.toggle('add-account', accounts.length > 0);
  ui.connect.disabled = connectingBusy || busyAccounts.size > 0 || state.connecting || !state.canConnect || Boolean(state.error);
  ui.cancel.hidden = !state.connecting;
  ui.notice.textContent = notice || errors[state.error] || ''; ui.notice.hidden = !ui.notice.textContent;
  ui.background.textContent = enabled ? 'Runs quietly while your Mac is awake. Starts with your Mac while any account is on.' : 'No AI API. Classification stays on this Mac.';
}
async function action(name, id) {
  if (name === 'connect') { if (connectingBusy || busyAccounts.size) return; connectingBusy = true; }
  else { if (blocked(name, id)) return; busyAccounts.add(id); }
  notice = ''; render();
  try {
    const result = await window.spammish[name](id);
    if (result.status) state = result.status;
    if (!result.ok) notice = errors[result.error] || 'Something interrupted the connection. Please try again.';
    else if (result.reconnected) notice = 'Gmail reconnected. Cleanup is on and its existing progress is preserved.';
    if (result.revokePending) notice = 'This local connection was removed. Google was unreachable; you can also revoke Spammish in your Google Account.';
  } catch { notice = 'Spammish couldn’t finish that action. Reopen the app and try again.'; }
  finally { if (name === 'connect') connectingBusy = false; else busyAccounts.delete(id); render(); }
}
ui.connect.addEventListener('click', () => { void action('connect'); });
ui.cancel.addEventListener('click', () => { void window.spammish.cancel(); });
window.spammish.onStatus((next) => { state = next; render(); });
window.spammish.status().then((next) => { state = next; render(); });

const reviewLoad = byId('review-load'), reviewItems = byId('review-items'), reviewNotice = byId('review-notice');
async function loadReview() {
  reviewLoad.disabled = true; reviewNotice.hidden = false; reviewNotice.textContent = 'Loading recent moves…';
  try {
    const result = await window.spammish.review();
    if (!result.ok) throw new Error(result.error);
    reviewItems.replaceChildren();
    reviewNotice.textContent = result.moves.length ? '' : 'No recorded moves yet. Recording starts with this update.';
    reviewNotice.hidden = Boolean(result.moves.length);
    for (const move of result.moves) {
      const row = element('section','review-item');
      row.append(element('p','review-subject',move.subject),element('p','review-sender',`${move.from || 'Sender unavailable'} · ${move.accountEmail}`));
      const explanation = explainDecision(move.decision);
      const details = element('details');details.append(element('summary','',explanation.title),element('p','',explanation.summary));
      const list = element('ul');
      for (const factor of explanation.factors) list.append(element('li','',`${factor.points > 0 ? '+' : ''}${factor.points} ${factor.label}`));
      details.append(list);row.append(details);
      if (move.inAbyss) {
        const rescue = element('button','text-button','Rescue');rescue.type='button';
        rescue.addEventListener('click',async()=>{
          rescue.disabled=true;
          try { const result=await window.spammish.rescueMessage(move.accountId,move.id);
            if(!result.ok)throw new Error(result.error);
            rescue.replaceWith(element('p','notice','Rescued. This sender is now protected.'));
          } catch { rescue.disabled=false;reviewNotice.hidden=false;reviewNotice.textContent='Rescue failed. Try again, or move the email back to Inbox in Gmail.'; }
        });row.append(rescue);
      } else row.append(element('p','notice','Already outside The Abyss.'));
      reviewItems.append(row);
    }
  } catch { reviewNotice.textContent='Could not load recent moves. Check your Gmail connection and try again.'; }
  finally { reviewLoad.disabled=false; }
}
reviewLoad.addEventListener('click',()=>{void loadReview();});
