import { describe, expect, it } from 'vitest';
import { feedBackoffDelay } from './feed-backoff-policy';

describe('feedBackoffDelay (transaction-feed reconnect — US-CW-014 AC-06)', () => {
  it('doubles the delay each attempt starting from the base', () => {
    expect(feedBackoffDelay(0)).toBe(1000);
    expect(feedBackoffDelay(1)).toBe(2000);
    expect(feedBackoffDelay(2)).toBe(4000);
    expect(feedBackoffDelay(3)).toBe(8000);
  });

  it('caps the delay at the configured maximum', () => {
    expect(feedBackoffDelay(20)).toBe(30_000);
  });

  it('honours custom base and max', () => {
    expect(feedBackoffDelay(0, { baseMs: 500, maxMs: 4000 })).toBe(500);
    expect(feedBackoffDelay(4, { baseMs: 500, maxMs: 4000 })).toBe(4000);
  });

  it('never goes below the base for a negative/first attempt', () => {
    expect(feedBackoffDelay(-1)).toBe(1000);
  });
});
