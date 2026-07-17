/**
 * Whether a proposed split of a bank transaction into portions is valid: the portions must sum
 * *exactly* to the source amount, to the cent (US-CW-016 AC-05). Working in integer minor units means
 * the check is exact — no floating-point tolerance — so a split that is even one cent short or over is
 * rejected. `ok:false` carries the totals and the signed difference so the caller can say precisely how
 * far off it is ("$500.00 short"). A portion count of zero, or any non-positive portion, is invalid.
 */
export interface SplitValidationResult {
  ok: boolean;
  /** The source transaction amount, minor units. */
  expectedMinorUnits: number;
  /** The sum of the provided portions, minor units. */
  providedMinorUnits: number;
  /** provided − expected: negative means short, positive means over, zero means balanced. */
  differenceMinorUnits: number;
}

export function validateSplit(
  transactionAmountMinorUnits: number,
  portionAmountsMinorUnits: readonly number[],
): SplitValidationResult {
  const provided = portionAmountsMinorUnits.reduce((total, amount) => total + amount, 0);
  const allPortionsPositive =
    portionAmountsMinorUnits.length > 0 &&
    portionAmountsMinorUnits.every((amount) => Number.isInteger(amount) && amount > 0);

  return {
    ok: allPortionsPositive && provided === transactionAmountMinorUnits,
    expectedMinorUnits: transactionAmountMinorUnits,
    providedMinorUnits: provided,
    differenceMinorUnits: provided - transactionAmountMinorUnits,
  };
}
