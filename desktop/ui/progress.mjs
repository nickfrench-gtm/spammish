export const isQuotaWait = (account) => account.error === 'connection_interrupted'
  && ['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','quotaExceeded'].includes(account.failureReason);

export function cleanupInstruction(account) {
  if (!account.enabled) return 'Paused. Turn on to resume checking this inbox.';
  if (account.sweepProgress) {
    const {processed,total}=account.sweepProgress;
    return `Checking existing inbox: ${processed.toLocaleString()} of ${total.toLocaleString()} messages processed. Progress is saved.`;
  }
  if (['queued','collecting'].includes(account.sweepPhase)) return 'Finding existing inbox messages before cleanup. You can pause at any time.';
  if (account.error) return 'The last check did not finish. Progress is saved.';
  return 'Initial inbox check complete. Watching new mail while this app runs.';
}

export function quotaNotice(account) {
  if (!account.enabled || !isQuotaWait(account)) return '';
  const when = account.retryAt ? new Date(account.retryAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : null;
  return when ? `Gmail is limiting requests. Next retry after ${when}; progress is saved.`
    : 'Gmail is limiting requests. Spammish will retry; progress is saved.';
}
