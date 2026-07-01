import { describe, expect, it } from 'vitest';
import { toMajorUnits } from './to-major-units';

describe('toMajorUnits', () => {
  it('divides by 100 for a 2-decimal currency (USD)', () => {
    expect(toMajorUnits({ amountMinorUnits: 182050, currency: 'USD' })).toBe(1820.5);
  });

  it('does not divide for a 0-decimal currency (JPY)', () => {
    expect(toMajorUnits({ amountMinorUnits: 182050, currency: 'JPY' })).toBe(182050);
  });

  it('divides by 1000 for a 3-decimal currency (BHD)', () => {
    expect(toMajorUnits({ amountMinorUnits: 182050, currency: 'BHD' })).toBe(182.05);
  });
});
