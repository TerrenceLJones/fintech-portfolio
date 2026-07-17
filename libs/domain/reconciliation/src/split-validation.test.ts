import { describe, expect, it } from 'vitest';
import { validateSplit } from './split-validation';

describe('validateSplit', () => {
  it('accepts portions that sum exactly to the transaction amount (AC-05)', () => {
    const result = validateSplit(500_000, [300_000, 200_000]);
    expect(result.ok).toBe(true);
    expect(result.differenceMinorUnits).toBe(0);
  });

  it('rejects a split that is short, carrying the shortfall', () => {
    const result = validateSplit(500_000, [300_000, 150_000]);
    expect(result.ok).toBe(false);
    expect(result.providedMinorUnits).toBe(450_000);
    expect(result.differenceMinorUnits).toBe(-50_000);
  });

  it('rejects a split that is over the amount', () => {
    const result = validateSplit(500_000, [300_000, 250_000]);
    expect(result.ok).toBe(false);
    expect(result.differenceMinorUnits).toBe(50_000);
  });

  it('rejects an empty split and any non-positive portion', () => {
    expect(validateSplit(500_000, []).ok).toBe(false);
    expect(validateSplit(500_000, [500_000, 0]).ok).toBe(false);
    expect(validateSplit(500_000, [600_000, -100_000]).ok).toBe(false);
  });
});
