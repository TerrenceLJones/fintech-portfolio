import { describe, expect, it } from 'vitest';
import {
  MAX_PAYMENT_RETRIES,
  PAYMENT_TIMEOUT_MS,
  backoffDelayWithJitter,
} from './payment-retry-policy';

describe('payment retry constants', () => {
  it('caps automatic retries at 3 (US-CW-007 AC-04)', () => {
    expect(MAX_PAYMENT_RETRIES).toBe(3);
  });

  it('enforces a 30-second request timeout (US-CW-007 AC-03)', () => {
    expect(PAYMENT_TIMEOUT_MS).toBe(30_000);
  });
});

describe('backoffDelayWithJitter', () => {
  it('grows exponentially with the attempt when jitter is maxed', () => {
    const one = () => 1;
    // full-jitter: delay = random() * base * 2^attempt, capped
    expect(backoffDelayWithJitter(0, { baseMs: 1000, random: one })).toBe(1000);
    expect(backoffDelayWithJitter(1, { baseMs: 1000, random: one })).toBe(2000);
    expect(backoffDelayWithJitter(2, { baseMs: 1000, random: one })).toBe(4000);
  });

  it('applies jitter — a smaller random fraction yields a proportionally smaller delay', () => {
    expect(backoffDelayWithJitter(2, { baseMs: 1000, random: () => 0.5 })).toBe(2000);
    expect(backoffDelayWithJitter(2, { baseMs: 1000, random: () => 0 })).toBe(0);
  });

  it('never exceeds maxMs even at high attempts', () => {
    const delay = backoffDelayWithJitter(20, { baseMs: 1000, maxMs: 30_000, random: () => 1 });
    expect(delay).toBe(30_000);
  });

  it('returns a value within [0, cap) for real random jitter', () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cap = Math.min(30_000, 1000 * 2 ** attempt);
      const delay = backoffDelayWithJitter(attempt, { baseMs: 1000, maxMs: 30_000 });
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(cap);
    }
  });
});
