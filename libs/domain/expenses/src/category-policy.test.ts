import { describe, expect, it } from 'vitest';
import { exceedsCategoryLimit } from './category-policy';

describe('exceedsCategoryLimit', () => {
  it('is true when the amount is strictly over the category per-transaction limit (AC-03)', () => {
    // $350.00 in a category with a $200.00 limit.
    expect(exceedsCategoryLimit(20_000, 35_000)).toBe(true);
  });

  it('is false at exactly the limit (boundary at $200.00)', () => {
    expect(exceedsCategoryLimit(20_000, 20_000)).toBe(false);
  });

  it('is false under the limit', () => {
    expect(exceedsCategoryLimit(20_000, 19_999)).toBe(false);
  });

  it('is false when the category carries no per-transaction limit', () => {
    expect(exceedsCategoryLimit(undefined, 1_000_000)).toBe(false);
  });
});
