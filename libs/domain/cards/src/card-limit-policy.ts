/**
 * The remaining monthly limit, DERIVED as monthlyLimit − authorizedSpend and floored at zero so it
 * can never go negative. This value is computed on demand everywhere it's shown and is never stored
 * as mutable state, so the displayed headroom can't drift from the true authorized spend
 * (US-CW-014 AC-02, "derived, not stored").
 */
export function deriveRemainingLimit(
  monthlyLimitMinorUnits: number,
  authorizedSpendMinorUnits: number,
): number {
  return Math.max(0, monthlyLimitMinorUnits - authorizedSpendMinorUnits);
}

/**
 * True when an authorization would exceed the remaining derived limit — the insufficient-limit
 * decline (US-CW-014 AC-04). An amount equal to the remaining limit is allowed (spends it to zero).
 */
export function exceedsRemainingLimit(
  monthlyLimitMinorUnits: number,
  authorizedSpendMinorUnits: number,
  amountMinorUnits: number,
): boolean {
  return amountMinorUnits > deriveRemainingLimit(monthlyLimitMinorUnits, authorizedSpendMinorUnits);
}
