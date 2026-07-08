import { describe, expect, it } from 'vitest';
import {
  hasOnboardingSessionTimedOut,
  ONBOARDING_INACTIVITY_TIMEOUT_MS,
} from './onboarding-inactivity-policy';

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;

describe('hasOnboardingSessionTimedOut', () => {
  it('is not timed out just under 30 minutes idle', () => {
    expect(hasOnboardingSessionTimedOut(NOW - (30 * MINUTE - 1000), NOW)).toBe(false);
  });

  it('is timed out at exactly 30 minutes idle', () => {
    expect(hasOnboardingSessionTimedOut(NOW - 30 * MINUTE, NOW)).toBe(true);
  });

  it('is timed out past 30 minutes idle', () => {
    expect(hasOnboardingSessionTimedOut(NOW - 45 * MINUTE, NOW)).toBe(true);
  });

  it('is not timed out immediately after activity', () => {
    expect(hasOnboardingSessionTimedOut(NOW, NOW)).toBe(false);
  });

  it('exposes the 30-minute threshold as a constant', () => {
    expect(ONBOARDING_INACTIVITY_TIMEOUT_MS).toBe(30 * MINUTE);
  });
});
