import { describe, expect, it } from 'vitest';
import { STEP_UP_THRESHOLD_MINOR_UNITS, requiresStepUp } from './step-up-policy';

describe('requiresStepUp', () => {
  it('requires step-up strictly above the threshold (US-CW-010 AC-01)', () => {
    // $12,000 over a $10,000 threshold → challenge.
    expect(requiresStepUp(1_200_000, 1_000_000)).toBe(true);
  });

  it('does NOT require step-up at exactly the threshold (boundary case)', () => {
    // "above the threshold" is strict — $10,000.00 exactly clears without a challenge.
    expect(requiresStepUp(1_000_000, 1_000_000)).toBe(false);
  });

  it('does NOT require step-up below the threshold', () => {
    expect(requiresStepUp(500_000, 1_000_000)).toBe(false);
  });

  it('defaults the threshold to $10,000.00 when not supplied', () => {
    expect(STEP_UP_THRESHOLD_MINOR_UNITS).toBe(1_000_000);
    expect(requiresStepUp(1_000_001)).toBe(true);
    expect(requiresStepUp(1_000_000)).toBe(false);
  });
});
