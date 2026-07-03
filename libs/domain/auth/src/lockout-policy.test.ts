import { describe, expect, it } from 'vitest';
import { isLockedOut } from './lockout-policy';

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;

function attemptsAgo(...minutesAgo: number[]) {
  return minutesAgo.map((m) => ({ timestamp: NOW - m * MINUTE }));
}

describe('isLockedOut', () => {
  it('is not locked out with 4 failed attempts inside the window', () => {
    expect(isLockedOut(attemptsAgo(1, 2, 3, 4), NOW)).toBe(false);
  });

  it('is locked out with 5 failed attempts inside the window', () => {
    expect(isLockedOut(attemptsAgo(1, 2, 3, 4, 5), NOW)).toBe(true);
  });

  it('is not locked out when only 4 of 5 attempts fall inside the 15-minute window', () => {
    expect(isLockedOut(attemptsAgo(1, 2, 3, 4, 16), NOW)).toBe(false);
  });

  it('excludes an attempt exactly at the 15-minute boundary', () => {
    expect(isLockedOut(attemptsAgo(1, 2, 3, 4, 15), NOW)).toBe(false);
  });

  it('is not locked out with zero attempts', () => {
    expect(isLockedOut([], NOW)).toBe(false);
  });
});
