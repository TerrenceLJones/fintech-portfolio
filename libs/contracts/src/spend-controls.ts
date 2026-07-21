/**
 * Spend controls edited in Settings → Spend Controls (US-CW-037): the receipt/memo thresholds, the
 * out-of-policy behavior, and per-category monthly caps. Like the approval ladder these feed the one
 * expense-submission gate (US-CW-011) — the value saved here is the value enforced at submit (AC-06/07/08).
 */

/** How the submission gate treats an out-of-policy (over category per-transaction limit) expense. */
export type OutOfPolicyBehavior = 'flag' | 'block';

/** A per-category monthly spend cap. `monthlyLimitMinorUnits: null` means unlimited (no cap). */
export interface CategorySpendCap {
  categoryId: string;
  label: string;
  monthlyLimitMinorUnits: number | null;
}

export interface SpendControlsResponse {
  receiptRequiredThresholdMinorUnits: number;
  memoRequiredThresholdMinorUnits: number;
  outOfPolicyBehavior: OutOfPolicyBehavior;
  categoryCaps: CategorySpendCap[];
  currency: string;
}

export interface CategorySpendCapInput {
  categoryId: string;
  monthlyLimitMinorUnits: number | null;
}

export interface UpdateSpendControlsRequest {
  receiptRequiredThresholdMinorUnits: number;
  memoRequiredThresholdMinorUnits: number;
  outOfPolicyBehavior: OutOfPolicyBehavior;
  categoryCaps: CategorySpendCapInput[];
}

export type SpendControlsErrorCode = 'forbidden_role' | 'unauthenticated' | 'invalid_threshold';

export interface SpendControlsErrorResponse {
  error: SpendControlsErrorCode;
}
