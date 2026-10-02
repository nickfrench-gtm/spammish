export const EVENTS = Object.freeze(['app_started', 'gmail_connected', 'first_abyss', 'returned_7d', 'returned_30d', 'rescue_performed']);
export const ENDPOINT = 'https://spammish.fly.dev/api/milestones';
// Leave room for five-day Fly snapshots and hourly purge within the 90-day public limit.
export const RECEIPT_DAYS = 84;
export const DAY = 86_400_000;
export function validPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === 'app_version,event,install_id,platform'
    && typeof value.install_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.install_id)
    && EVENTS.includes(value.event) && typeof value.app_version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value.app_version)
    && ['darwin', 'linux', 'win32'].includes(value.platform);
}
