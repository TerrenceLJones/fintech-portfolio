/** Automatic retries for a payment submission are capped at 3 attempts (US-CW-007 AC-04). */
export const MAX_PAYMENT_RETRIES = 3;

/** A payment request that gets no response within 30s is abandoned in favour of status polling (AC-03). */
export const PAYMENT_TIMEOUT_MS = 30_000;

export interface BackoffOptions {
  /** Base delay in ms for attempt 0. */
  baseMs?: number;
  /** Ceiling the exponential term is capped to before jitter. */
  maxMs?: number;
  /** Injectable [0,1) source for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

/**
 * Full-jitter exponential backoff (US-CW-007 AC-04): delay = random() · min(maxMs, baseMs · 2^attempt).
 * Jitter spreads out retries from many clients so a recovering server isn't hit by a synchronized
 * thundering herd, while the exponential term still backs off progressively. `attempt` is 0-based.
 */
export function backoffDelayWithJitter(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 1000, maxMs = PAYMENT_TIMEOUT_MS, random = Math.random } = options;
  const capped = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(random() * capped);
}
