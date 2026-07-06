import { describe, expect, it } from 'vitest';
import { getInactivityPhase, getWarningSecondsRemaining } from './inactivity-policy';

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;

describe('getInactivityPhase', () => {
  it('is active at 13 minutes 59 seconds idle', () => {
    expect(getInactivityPhase(NOW - (14 * MINUTE - 1000), NOW)).toBe('active');
  });

  it('is warning at exactly 14 minutes idle', () => {
    expect(getInactivityPhase(NOW - 14 * MINUTE, NOW)).toBe('warning');
  });

  it('is warning at 14 minutes 59 seconds idle', () => {
    expect(getInactivityPhase(NOW - (15 * MINUTE - 1000), NOW)).toBe('warning');
  });

  it('is expired at exactly 15 minutes idle', () => {
    expect(getInactivityPhase(NOW - 15 * MINUTE, NOW)).toBe('expired');
  });

  it('is active immediately after activity', () => {
    expect(getInactivityPhase(NOW, NOW)).toBe('active');
  });
});

describe('getWarningSecondsRemaining', () => {
  it('is 60 seconds at exactly the 14-minute mark', () => {
    expect(getWarningSecondsRemaining(NOW - 14 * MINUTE, NOW)).toBe(60);
  });

  it('is 30 seconds halfway through the warning window', () => {
    expect(getWarningSecondsRemaining(NOW - 14 * MINUTE - 30_000, NOW)).toBe(30);
  });

  it('is 0 at the 15-minute cutoff', () => {
    expect(getWarningSecondsRemaining(NOW - 15 * MINUTE, NOW)).toBe(0);
  });

  it('floors at 0 past the cutoff rather than going negative', () => {
    expect(getWarningSecondsRemaining(NOW - 16 * MINUTE, NOW)).toBe(0);
  });
});
