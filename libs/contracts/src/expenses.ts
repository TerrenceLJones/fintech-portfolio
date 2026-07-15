import type { Money } from './money';

/**
 * The submitted-expense lifecycle (US-CW-011 / US-CW-012). An expense is submitted into `pending_l1`
 * (or straight to `pending_l2` when its amount is over the designated approver's limit — AC-04), then
 * resolved to `approved` or `rejected` by an approver. The approval queue (`ApprovalQueueItem` in
 * ./rbac) is the approver's projection of the `pending_*` slice of this same lifecycle.
 */
export type ExpenseStatus = 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';

/**
 * A spend category an expense is filed under. `perTransactionLimitMinorUnits` is the advisory
 * policy limit surfaced as a real-time warning (US-CW-011 AC-03) — exceeding it never blocks
 * submission, it only flags the expense for extra scrutiny in the approval queue. Undefined = the
 * category carries no per-transaction limit.
 */
export interface ExpenseCategory {
  id: string;
  label: string;
  perTransactionLimitMinorUnits?: number;
}

/**
 * Everything the New Expense form needs to validate an expense before submitting it — the categories
 * (with their advisory limits) and the receipt-required threshold echoed from @clearline/domain-expenses
 * so the UI can render "A receipt is required for expenses over $75.00" without hardcoding the figure.
 */
export interface ExpenseContextResponse {
  categories: ExpenseCategory[];
  /** A receipt is required for expenses strictly over this amount (minor units) — US-CW-011 AC-02. */
  receiptRequiredThresholdMinorUnits: number;
  /**
   * The organization's expense currency (ISO 4217). Expenses are single-currency — unlike vendor
   * payments there is no FX — so the form parses, formats, and submits amounts in this one currency,
   * sourced from the server rather than hardcoded in the client.
   */
  currency: string;
}

/**
 * A submitted expense. `policyFlagged` is set when the amount exceeded its category's per-transaction
 * limit at submit time (AC-03) so the approval queue can mark it for scrutiny. `routedToName` is the
 * approver it was routed to on submit (by amount + policy), shown in the submission confirmation.
 */
export interface Expense {
  id: string;
  submitterId: string;
  submitterName: string;
  categoryId: string;
  categoryLabel: string;
  merchant: string;
  amount: Money;
  /** ISO 8601 date the expense was submitted. */
  submittedDate: string;
  status: ExpenseStatus;
  /** Filename of the attached receipt, when one is attached (the demo models a receipt by name, not bytes). */
  receiptFilename?: string;
  /** True when the amount exceeded the category policy limit at submit — flagged for extra scrutiny. */
  policyFlagged?: boolean;
  /** The approver this expense was routed to at submit (US-CW-011 AC-01). */
  routedToName?: string;
  /** Present once rejected — the reason the submitter sees and can correct against (US-CW-012 AC-02). */
  rejectionReason?: string;
}

/**
 * An expense submission. The receipt is modeled as a filename (`receiptFilename`) rather than binary
 * upload for the demo backend. `policyLimitAcknowledged` records that the submitter saw the advisory
 * category-limit warning and chose to submit anyway (AC-03) — the server flags but does not block it.
 */
export interface CreateExpenseRequest {
  amount: Money;
  categoryId: string;
  merchant: string;
  receiptFilename?: string;
  policyLimitAcknowledged?: boolean;
}

export interface ExpenseResponse {
  expense: Expense;
}

export interface MyExpensesResponse {
  expenses: Expense[];
}

/**
 * Server-side expense-validation failures (422). Mirrors the client-side @clearline/domain-expenses
 * gate so a submission that bypasses the UI is re-checked at the boundary (US-CW-011 technical notes).
 * The category policy-limit warning is deliberately NOT here — it is advisory and never blocks submit.
 */
export type ExpenseErrorCode = 'invalid_amount' | 'category_required' | 'receipt_required';

export interface ExpenseErrorResponse {
  error: ExpenseErrorCode;
}
