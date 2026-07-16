/**
 * A compact, human relative time for a feed row's timestamp — "just now", "2h ago", "Yesterday", or a
 * "Jun 26"-style date for anything older. Kept dependency-free (no date lib) and pure so it's easy to
 * reason about; `now` is injectable for deterministic tests.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';

  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
