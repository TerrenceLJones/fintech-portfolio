const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Mints a UUID v4 idempotency key, generated client-side exactly once per payment intent and then
 * reused across every in-flight duplicate, timeout retry and 5xx backoff so money moves exactly once
 * (US-CW-007). A genuinely new operation (e.g. a changed amount after an idempotency mismatch) mints
 * a fresh key — never the caller reusing a stale one.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Guards that a string is a canonical UUID v4 — the shape the Idempotency-Key header must carry. */
export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}
