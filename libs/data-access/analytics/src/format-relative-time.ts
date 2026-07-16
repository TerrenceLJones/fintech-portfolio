/**
 * Beyond this age the dashboard's data is treated as stale: the freshness indicator elevates to a
 * warning and prompts a manual Refresh (US-CW-015 AC-06). The design's stale example is 10 minutes;
 * 5 is the threshold at which "a noticeable time" has passed.
 */
export const STALE_THRESHOLD_MINUTES = 5;

const MINUTE = 60_000;

/** Whole minutes between a past ISO timestamp and `now` (never negative). */
export function ageInMinutes(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / MINUTE));
}

/** True once the data is older than the stale threshold — drives the warning treatment + Refresh (AC-06). */
export function isStale(iso: string, now: number): boolean {
  return ageInMinutes(iso, now) >= STALE_THRESHOLD_MINUTES;
}

/**
 * A compact relative age like "just now", "1 minute ago", "10 minutes ago", "2 hours ago" — the
 * client passes `now` explicitly so the freshness label is deterministic in tests (US-CW-015 AC-06).
 * The page composes it into "Last updated {age}".
 */
export function formatRelativeAge(iso: string, now: number): string {
  const minutes = ageInMinutes(iso, now);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
