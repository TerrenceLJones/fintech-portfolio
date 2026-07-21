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

/**
 * True when company policy requires a receipt for this amount — strictly over the threshold. The
 * threshold defaults to the standard $75.00 but is a parameter so the org's configured spend-control
 * value drives it (US-CW-037 AC-06) rather than a hardcoded copy.
 */
export function requiresReceipt(
  amountMinorUnits: number,
  thresholdMinorUnits: number = RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS,
): boolean {
  return amountMinorUnits > thresholdMinorUnits;
}

/**
 * True when company policy requires a memo for this amount — strictly over the threshold (US-CW-037
 * AC-06). A threshold of 0 (or less) means "no memo requirement configured", so a memo is never forced.
 */
export function requiresMemo(amountMinorUnits: number, thresholdMinorUnits: number): boolean {
  return thresholdMinorUnits > 0 && amountMinorUnits > thresholdMinorUnits;
}

export interface ExpenseValidationInput {
  amountMinorUnits: number;
  /** The selected category id, or null when none has been chosen yet. */
  categoryId: string | null;
  hasReceipt: boolean;
  /** Whether a non-empty memo was provided — checked only when the amount is over the memo threshold. */
  hasMemo?: boolean;
  /** Receipt threshold from the org's spend controls; defaults to the standard $75.00. */
  receiptRequiredThresholdMinorUnits?: number;
  /** Memo threshold from the org's spend controls; 0 (default) means no memo requirement. */
  memoRequiredThresholdMinorUnits?: number;
}

export type ExpenseValidationResult = { ok: true } | { ok: false; reason: ExpenseErrorCode };

/**
 * The single gate every expense passes through, run client-side to pre-block submit and server-side to
 * independently reject (US-CW-011 technical notes) — the same validatePayment pattern (US-CW-008).
 * Checks run in priority order so the caller surfaces the most fundamental reason first: a malformed
 * amount (not an expense at all) outranks a missing category, then a missing receipt, then a missing memo.
 * The receipt/memo thresholds are the org's configured spend-control values (US-CW-037 AC-06), passed in
 * so this gate reads the one policy model rather than a hardcoded copy.
 *
 * The advisory category policy-limit warning is deliberately NOT enforced here — under `flag` it never
 * blocks submission (see exceedsCategoryLimit, AC-03); the `block` behaviour and per-category monthly caps
 * (AC-07/AC-08) are enforced by the submission service, which has the month-to-date spend to check them.
 */
export function validateExpense(input: ExpenseValidationInput): ExpenseValidationResult {
  if (!isValidExpenseAmount(input.amountMinorUnits)) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (!input.categoryId) {
    return { ok: false, reason: 'category_required' };
  }
  if (
    requiresReceipt(input.amountMinorUnits, input.receiptRequiredThresholdMinorUnits) &&
    !input.hasReceipt
  ) {
    return { ok: false, reason: 'receipt_required' };
  }
  if (
    requiresMemo(input.amountMinorUnits, input.memoRequiredThresholdMinorUnits ?? 0) &&
    !input.hasMemo
  ) {
    return { ok: false, reason: 'memo_required' };
  }
  return { ok: true };
}
