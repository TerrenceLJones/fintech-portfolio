import { describe, expect, it } from 'vitest';
import { daysBetween } from './date-proximity';

describe('daysBetween', () => {
  it('is 0 for the same day and counts whole days regardless of order', () => {
    expect(daysBetween('2026-06-28', '2026-06-28')).toBe(0);
    expect(daysBetween('2026-06-27', '2026-06-28')).toBe(1);
    expect(daysBetween('2026-06-30', '2026-06-27')).toBe(3);
  });

  it('spans month boundaries correctly', () => {
    expect(daysBetween('2026-06-30', '2026-07-02')).toBe(2);
  });

  it('returns Infinity for a malformed date so it can never masquerade as same-day', () => {
    expect(daysBetween('not-a-date', '2026-06-28')).toBe(Infinity);
  });
});
