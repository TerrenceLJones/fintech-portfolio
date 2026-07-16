export interface FeedBackoffOptions {
  /** Delay before the first reconnect attempt; doubles each subsequent attempt. Default 1s. */
  baseMs?: number;
  /** Ceiling the doubling is clamped to, so backoff never grows unbounded. Default 30s. */
  maxMs?: number;
}

/**
 * The exponential delay (ms) before the Nth reconnect attempt of the transaction feed
 * (US-CW-014 AC-06). `attempt` is 0-based: attempt 0 waits `baseMs`, then the delay doubles each try,
 * clamped to `maxMs`. Deliberately jitter-free — the countdown is shown to the user ("retry in 4s"),
 * so it must be deterministic and displayable.
 */
export function feedBackoffDelay(
  attempt: number,
  { baseMs = 1000, maxMs = 30_000 }: FeedBackoffOptions = {},
): number {
  if (attempt < 0) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** attempt);
}
