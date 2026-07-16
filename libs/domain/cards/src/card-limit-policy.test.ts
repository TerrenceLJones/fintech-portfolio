import { describe, expect, it } from 'vitest';
import { deriveRemainingLimit, exceedsRemainingLimit } from './card-limit-policy';

describe('deriveRemainingLimit', () => {
  it('derives remaining as monthly limit minus authorized spend (US-CW-014 AC-02)', () => {
    // $2,000.00 limit, $150.00 authorized → $1,850.00 remaining.
    expect(deriveRemainingLimit(200_000, 15_000)).toBe(185_000);
  });

  it('returns the full limit when nothing has been authorized', () => {
    expect(deriveRemainingLimit(200_000, 0)).toBe(200_000);
  });

  it('floors at zero rather than going negative when spend meets or exceeds the limit', () => {
    expect(deriveRemainingLimit(200_000, 200_000)).toBe(0);
    expect(deriveRemainingLimit(200_000, 250_000)).toBe(0);
  });
});

describe('exceedsRemainingLimit', () => {
  it('is true when the amount is more than the remaining derived limit (AC-04)', () => {
    // $50.00 remaining, $75.00 attempted → exceeds.
    expect(exceedsRemainingLimit(200_000, 195_000, 7_500)).toBe(true);
  });

  it('is false when the amount fits exactly within the remaining limit', () => {
    expect(exceedsRemainingLimit(200_000, 195_000, 5_000)).toBe(false);
  });

  it('is false for an amount comfortably under the remaining limit', () => {
    expect(exceedsRemainingLimit(200_000, 15_000, 5_000)).toBe(false);
  });
});
