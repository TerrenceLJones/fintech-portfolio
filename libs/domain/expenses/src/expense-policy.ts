import type { ExpenseErrorCode } from '@clearline/contracts';

/**
 * A receipt is required for expenses strictly over this amount (minor units) — $75.00 (US-CW-011 AC-02).
 * "Over $75.00" is strict, so an expense at exactly $75.00 needs no receipt (the boundary edge case).
 */
export const RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS = 7_500;

/**
 * True when the amount is a well-formed expense figure: a positive integer number of minor units.
 * Rejects zero, negatives, fractional minor units, `NaN`, and `Infinity` — re-checked server-side so
 * the boundary can't be bypassed into a $0/negative expense.
 */
export function isValidExpenseAmount(amountMinorUnits: number): boolean {
  return Number.isInteger(amountMinorUnits) && amountMinorUnits > 0;
}

/** True when company policy requires a receipt for this amount — strictly over the $75.00 threshold. */
export function requiresReceipt(amountMinorUnits: number): boolean {
  return amountMinorUnits > RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS;
}

export interface ExpenseValidationInput {
  amountMinorUnits: number;
  /** The selected category id, or null when none has been chosen yet. */
  categoryId: string | null;
  hasReceipt: boolean;
}

export type ExpenseValidationResult = { ok: true } | { ok: false; reason: ExpenseErrorCode };

/**
 * The single gate every expense passes through, run client-side to pre-block submit and server-side to
 * independently reject (US-CW-011 technical notes) — the same validatePayment pattern (US-CW-008).
 * Checks run in priority order so the caller surfaces the most fundamental reason first: a malformed
 * amount (not an expense at all) outranks a missing category, which outranks the missing receipt.
 *
 * The advisory category policy-limit warning is deliberately NOT enforced here — it never blocks
 * submission (see exceedsCategoryLimit, AC-03).
 */
export function validateExpense(input: ExpenseValidationInput): ExpenseValidationResult {
  if (!isValidExpenseAmount(input.amountMinorUnits)) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (!input.categoryId) {
    return { ok: false, reason: 'category_required' };
  }
  if (requiresReceipt(input.amountMinorUnits) && !input.hasReceipt) {
    return { ok: false, reason: 'receipt_required' };
  }
  return { ok: true };
}
