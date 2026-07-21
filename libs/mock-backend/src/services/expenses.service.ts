import type {
  ApprovalPolicyTier,
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  ExpenseErrorCode,
  OutOfPolicyBehavior,
  Permission,
} from '@clearline/contracts';
import { hasPermission } from '@clearline/domain-auth';
import {
  DEFAULT_APPROVAL_TIERS,
  exceedsCategoryLimit,
  routeByTiers,
  validateExpense,
  RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS,
} from '@clearline/domain-expenses';
import { ApprovalsService } from './approvals.service';
import {
  EXPENSE_CURRENCY,
  EXPENSE_L1_APPROVER_NAME,
  EXPENSE_L2_APPROVER_NAME,
  SEED_EXPENSE_CATEGORIES,
  SEED_MY_EXPENSES,
} from '../fixtures/expenses.fixture';

/** The resolved submitting user — its permissions and org come from the session (see expenses.handlers). */
export interface ExpenseActor {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
  /** The caller's organization, so the org's own policy drives routing + enforcement (US-CW-037). */
  orgId: string;
}

export type ExpenseContextOutcome =
  | {
      outcome: 'ok';
      categories: ExpenseCategory[];
      receiptRequiredThresholdMinorUnits: number;
      memoRequiredThresholdMinorUnits: number;
      outOfPolicyBehavior: OutOfPolicyBehavior;
      currency: string;
    }
  | { outcome: 'forbidden' };

/**
 * How the ExpensesService reads the org's live approval + spend-control policy (US-CW-037 AC-10). The
 * shared instance adapts this over AuthService so editing the policy in Settings changes routing and
 * enforcement here directly, with no divergent copy; isolated tests get the default (current) behaviour.
 */
export interface ExpensePolicyProvider {
  approvalTiers(orgId: string): ApprovalPolicyTier[];
  spendControls(orgId: string): {
    receiptRequiredThresholdMinorUnits: number;
    memoRequiredThresholdMinorUnits: number;
    outOfPolicyBehavior: OutOfPolicyBehavior;
    /** categoryId → monthly cap in minor units (`null` = unlimited). Absent id = unlimited. */
    categoryCaps: Record<string, number | null>;
  };
}

/** The default policy provider: the standard ladder and today's spend behaviour (no memo, flag, no caps). */
const DEFAULT_POLICY_PROVIDER: ExpensePolicyProvider = {
  approvalTiers: () => DEFAULT_APPROVAL_TIERS.map((tier) => ({ ...tier })),
  spendControls: () => ({
    receiptRequiredThresholdMinorUnits: RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS,
    memoRequiredThresholdMinorUnits: 0,
    outOfPolicyBehavior: 'flag',
    categoryCaps: {},
  }),
};

export type ExpenseSubmitOutcome =
  | { outcome: 'ok'; expense: Expense }
  | { outcome: 'validation_error'; reason: ExpenseErrorCode }
  | { outcome: 'forbidden' };

export type MyExpensesOutcome = { outcome: 'ok'; expenses: Expense[] } | { outcome: 'forbidden' };

/**
 * In-memory expense store with server-authoritative policy enforcement (US-CW-011). Submissions run
 * through @clearline/domain-expenses' validateExpense — the same gate the New Expense form uses — so a
 * caller who bypasses the UI still can't submit a $0, category-less, or receipt-missing-over-$75
 * expense. A valid submission is routed by amount (L1 vs L2) and enqueued into the shared
 * ApprovalsService so it appears in the approver's queue (AC-01). The submitter's My Expenses list is
 * reconciled against that queue's resolutions, so an approver's approve/reject flips the submitter's
 * view (AC-02). State is per-instance; the app binds the shared singleton (see shared-expenses-service).
 */
export class ExpensesService {
  private readonly expenses: Map<string, Expense>;
  private readonly categories: ExpenseCategory[];
  private readonly approvals: ApprovalsService;
  private readonly clock: () => number;
  private readonly policy: ExpensePolicyProvider;
  private nextId = 4600;

  constructor(
    seed: Expense[] = SEED_MY_EXPENSES,
    categories: ExpenseCategory[] = SEED_EXPENSE_CATEGORIES,
    approvals: ApprovalsService = new ApprovalsService(),
    clock: () => number = () => Date.now(),
    policy: ExpensePolicyProvider = DEFAULT_POLICY_PROVIDER,
  ) {
    this.expenses = new Map(seed.map((e) => [e.id, { ...e, amount: { ...e.amount } }]));
    this.categories = categories.map((c) => ({ ...c }));
    this.approvals = approvals;
    this.clock = clock;
    this.policy = policy;
  }

  getContext(actor: ExpenseActor): ExpenseContextOutcome {
    if (!hasPermission(actor.permissions, 'expenses:view')) return { outcome: 'forbidden' };
    const controls = this.policy.spendControls(actor.orgId);
    return {
      outcome: 'ok',
      categories: this.categories.map((c) => ({ ...c })),
      receiptRequiredThresholdMinorUnits: controls.receiptRequiredThresholdMinorUnits,
      memoRequiredThresholdMinorUnits: controls.memoRequiredThresholdMinorUnits,
      outOfPolicyBehavior: controls.outOfPolicyBehavior,
      currency: EXPENSE_CURRENCY,
    };
  }

  submit(request: CreateExpenseRequest, actor: ExpenseActor): ExpenseSubmitOutcome {
    if (!hasPermission(actor.permissions, 'expenses:view')) return { outcome: 'forbidden' };

    const controls = this.policy.spendControls(actor.orgId);
    const category = this.categories.find((c) => c.id === request.categoryId);
    // Re-run the same client gate server-side, reading the org's configured thresholds (AC-06). An
    // unknown category is treated as no category chosen.
    const validation = validateExpense({
      amountMinorUnits: request.amount.amountMinorUnits,
      categoryId: category ? category.id : null,
      hasReceipt: Boolean(request.receiptFilename),
      hasMemo: Boolean(request.memo && request.memo.trim()),
      receiptRequiredThresholdMinorUnits: controls.receiptRequiredThresholdMinorUnits,
      memoRequiredThresholdMinorUnits: controls.memoRequiredThresholdMinorUnits,
    });
    if (!validation.ok) return { outcome: 'validation_error', reason: validation.reason };
    // `category` is guaranteed defined once validation passes (category_required covers the absent case).
    if (!category) return { outcome: 'validation_error', reason: 'category_required' };

    const overCategoryLimit = exceedsCategoryLimit(
      category.perTransactionLimitMinorUnits,
      request.amount.amountMinorUnits,
    );
    // Out-of-policy behaviour (AC-07): under `block`, an over-limit expense is hard-rejected here
    // instead of being flagged-and-allowed.
    if (overCategoryLimit && controls.outOfPolicyBehavior === 'block') {
      return { outcome: 'validation_error', reason: 'over_policy_blocked' };
    }

    // Per-category monthly cap (AC-08): the submitter's month-to-date spend in this category plus this
    // expense may not exceed the cap. Historical spend already over the cap is not retroactively voided.
    const cap = controls.categoryCaps[category.id];
    if (cap != null) {
      const monthToDate = this.monthToDateSpend(actor.userId, category.id);
      if (monthToDate + request.amount.amountMinorUnits > cap) {
        return { outcome: 'validation_error', reason: 'over_category_cap' };
      }
    }

    // Route against the org's live tier ladder — the single policy model (AC-10). An `auto` tier
    // auto-approves the expense (no approver, no queue); otherwise it enters the approver's queue.
    const { approver, status } = routeByTiers(
      request.amount.amountMinorUnits,
      this.policy.approvalTiers(actor.orgId),
    );
    const policyFlagged = overCategoryLimit;
    const routedToName =
      approver === 'auto'
        ? undefined
        : status === 'pending_l2'
          ? EXPENSE_L2_APPROVER_NAME
          : EXPENSE_L1_APPROVER_NAME;
    const id = `exp_${this.nextId++}`;

    const expense: Expense = {
      id,
      submitterId: actor.userId,
      submitterName: actor.displayName,
      categoryId: category.id,
      categoryLabel: category.label,
      merchant: request.merchant,
      amount: { ...request.amount },
      ...(request.memo && request.memo.trim() ? { memo: request.memo.trim() } : {}),
      submittedDate: new Date(this.clock()).toISOString().slice(0, 10),
      status,
      ...(request.receiptFilename ? { receiptFilename: request.receiptFilename } : {}),
      ...(policyFlagged ? { policyFlagged: true } : {}),
      ...(routedToName ? { routedToName } : {}),
    };
    this.expenses.set(id, expense);

    // An auto-approved expense never needs an approver, so it skips the queue entirely (AC-10). Every
    // other expense joins the approval queue so an approver can act on it (AC-01) — the queue item is
    // the approver's projection: only the fields it shows, plus the scrutiny flag (AC-03).
    if (approver !== 'auto') {
      this.approvals.enqueue({
        id,
        submitterId: actor.userId,
        submitterName: actor.displayName,
        category: category.label,
        amount: { ...request.amount },
        submittedDate: expense.submittedDate,
        // Non-auto approvers always yield a pending status; narrow it for the approval queue item.
        status: status === 'pending_l2' ? 'pending_l2' : 'pending_l1',
        ...(policyFlagged ? { policyFlagged: true } : {}),
      });
    }

    return { outcome: 'ok', expense: { ...expense, amount: { ...expense.amount } } };
  }

  /** The submitter's non-rejected spend in a category during the current (clock) month, in minor units. */
  private monthToDateSpend(submitterId: string, categoryId: string): number {
    const yearMonth = new Date(this.clock()).toISOString().slice(0, 7);
    let total = 0;
    for (const expense of this.expenses.values()) {
      if (
        expense.submitterId === submitterId &&
        expense.categoryId === categoryId &&
        expense.status !== 'rejected' &&
        expense.submittedDate.slice(0, 7) === yearMonth
      ) {
        total += expense.amount.amountMinorUnits;
      }
    }
    return total;
  }

  listMine(actor: ExpenseActor): MyExpensesOutcome {
    if (!hasPermission(actor.permissions, 'expenses:view')) return { outcome: 'forbidden' };
    const expenses = [...this.expenses.values()]
      .filter((e) => e.submitterId === actor.userId)
      .map((e) => this.reconcile(e));
    return { outcome: 'ok', expenses };
  }

  /**
   * Overlays an approver's decision onto the submitter's copy: an approve/reject in the queue flips the
   * expense's status (and surfaces the rejection reason) so the submitter sees the outcome (AC-02). A
   * reassignment leaves it pending — it's been handed to another approver, not resolved.
   */
  private reconcile(expense: Expense): Expense {
    const resolution = this.approvals.getResolution(expense.id);
    const copy: Expense = { ...expense, amount: { ...expense.amount } };
    if (resolution?.action === 'approved') copy.status = 'approved';
    if (resolution?.action === 'rejected') {
      copy.status = 'rejected';
      if (resolution.reason) copy.rejectionReason = resolution.reason;
    }
    return copy;
  }
}
