/**
 * True when an amount is strictly over a category's per-transaction policy limit (US-CW-011 AC-03).
 * This is ADVISORY: it surfaces an inline warning before submit and flags the expense for extra
 * scrutiny in the approval queue, but it never blocks submission (unlike validateExpense). "Exceeds"
 * is strict, so an amount at exactly the limit is within policy (the boundary edge case). A category
 * with no configured limit (`undefined`) never triggers the warning.
 */
export function exceedsCategoryLimit(
  perTransactionLimitMinorUnits: number | undefined,
  amountMinorUnits: number,
): boolean {
  if (perTransactionLimitMinorUnits === undefined) return false;
  return amountMinorUnits > perTransactionLimitMinorUnits;
}
