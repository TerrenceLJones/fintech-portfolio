import { describe, expect, it } from 'vitest';
import {
  cutoffMsForMinutes,
  getInactivityPhase,
  getWarningSecondsRemaining,
  INACTIVITY_CUTOFF_MS,
} from './inactivity-policy';

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

describe('org-configurable cutoff (US-CW-040 AC-05)', () => {
  it('cutoffMsForMinutes converts minutes, falling back to the 15-minute default', () => {
    expect(cutoffMsForMinutes(60)).toBe(60 * MINUTE);
    expect(cutoffMsForMinutes(undefined)).toBe(INACTIVITY_CUTOFF_MS);
    expect(cutoffMsForMinutes(0)).toBe(INACTIVITY_CUTOFF_MS);
  });

  it('a 1-hour cutoff keeps a member active at 30 minutes idle', () => {
    const oneHour = cutoffMsForMinutes(60);
    expect(getInactivityPhase(NOW - 30 * MINUTE, NOW, oneHour)).toBe('active');
  });

  it('a 1-hour cutoff warns in the final minute and expires at the hour', () => {
    const oneHour = cutoffMsForMinutes(60);
    expect(getInactivityPhase(NOW - 59 * MINUTE, NOW, oneHour)).toBe('warning');
    expect(getInactivityPhase(NOW - 60 * MINUTE, NOW, oneHour)).toBe('expired');
    expect(getWarningSecondsRemaining(NOW - 59 * MINUTE, NOW, oneHour)).toBe(60);
  });
});
