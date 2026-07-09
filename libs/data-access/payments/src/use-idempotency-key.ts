import { useCallback, useState } from 'react';
import { generateIdempotencyKey } from '@clearline/domain-payments';

export interface IdempotencyKeyHandle {
  /** The current key — stable across re-renders and reused across every retry of one payment intent. */
  key: string;
  /** Mints a fresh key. Called only for a genuinely new operation (e.g. after an idempotency mismatch). */
  reset: () => void;
}

/**
 * Holds one UUID v4 idempotency key per payment intent (US-CW-007). Minted once on mount and kept
 * stable so double-clicks, timeout retries and 5xx backoff all reuse it — a fresh key is minted only
 * when the caller `reset()`s it for a genuinely new operation (AC-05's changed-payload resubmission).
 *
 * `initialKey` seeds the key from a preserved value — e.g. one persisted before a session-expiry
 * redirect, so re-authentication resumes the exact same payment intent rather than a new one (AC-06).
 */
export function useIdempotencyKey(initialKey?: string): IdempotencyKeyHandle {
  const [key, setKey] = useState<string>(() => initialKey ?? generateIdempotencyKey());
  const reset = useCallback(() => setKey(generateIdempotencyKey()), []);
  return { key, reset };
}
