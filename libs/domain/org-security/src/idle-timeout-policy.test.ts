import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_OPTIONS, idleTimeoutLabel, isValidIdleTimeout } from './idle-timeout-policy';

describe('idle-timeout policy', () => {
  it('offers the expected option ladder', () => {
    expect(IDLE_TIMEOUT_OPTIONS.map((o) => o.minutes)).toEqual([15, 30, 60, 240, 480]);
  });

  it('validates membership in the ladder', () => {
    expect(isValidIdleTimeout(60)).toBe(true);
    expect(isValidIdleTimeout(15)).toBe(true);
    expect(isValidIdleTimeout(45)).toBe(false);
    expect(isValidIdleTimeout(0)).toBe(false);
  });

  it('labels durations in human units', () => {
    expect(idleTimeoutLabel(15)).toBe('15 minutes');
    expect(idleTimeoutLabel(60)).toBe('1 hour');
    expect(idleTimeoutLabel(240)).toBe('4 hours');
  });
});
