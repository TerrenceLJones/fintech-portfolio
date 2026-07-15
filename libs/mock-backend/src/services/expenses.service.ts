import type {
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  ExpenseErrorCode,
  Permission,
} from '@clearline/contracts';
import { hasPermission } from '@clearline/domain-auth';
import {
  exceedsCategoryLimit,
  routeSubmittedStatus,
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

/** The resolved submitting user — its permissions come from the session (see expenses.handlers). */
export interface ExpenseActor {
  userId: string;
  displayName: string;
  permissions: readonly Permission[];
}

export type ExpenseContextOutcome =
  | {
      outcome: 'ok';
      categories: ExpenseCategory[];
      receiptRequiredThresholdMinorUnits: number;
      currency: string;
    }
  | { outcome: 'forbidden' };

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
  private nextId = 4600;

  constructor(
    seed: Expense[] = SEED_MY_EXPENSES,
    categories: ExpenseCategory[] = SEED_EXPENSE_CATEGORIES,
    approvals: ApprovalsService = new ApprovalsService(),
    clock: () => number = () => Date.now(),
  ) {
    this.expenses = new Map(seed.map((e) => [e.id, { ...e, amount: { ...e.amount } }]));
    this.categories = categories.map((c) => ({ ...c }));
    this.approvals = approvals;
    this.clock = clock;
  }

  getContext(actor: ExpenseActor): ExpenseContextOutcome {
    if (!hasPermission(actor.permissions, 'expenses:view')) return { outcome: 'forbidden' };
    return {
      outcome: 'ok',
      categories: this.categories.map((c) => ({ ...c })),
      receiptRequiredThresholdMinorUnits: RECEIPT_REQUIRED_THRESHOLD_MINOR_UNITS,
      currency: EXPENSE_CURRENCY,
    };
  }

  submit(request: CreateExpenseRequest, actor: ExpenseActor): ExpenseSubmitOutcome {
    if (!hasPermission(actor.permissions, 'expenses:view')) return { outcome: 'forbidden' };

    const category = this.categories.find((c) => c.id === request.categoryId);
    // Re-run the same client gate server-side. An unknown category is treated as no category chosen.
    const validation = validateExpense({
      amountMinorUnits: request.amount.amountMinorUnits,
      categoryId: category ? category.id : null,
      hasReceipt: Boolean(request.receiptFilename),
    });
    if (!validation.ok) return { outcome: 'validation_error', reason: validation.reason };
    // `category` is guaranteed defined once validation passes (category_required covers the absent case).
    if (!category) return { outcome: 'validation_error', reason: 'category_required' };

    const status = routeSubmittedStatus(request.amount.amountMinorUnits);
    const policyFlagged = exceedsCategoryLimit(
      category.perTransactionLimitMinorUnits,
      request.amount.amountMinorUnits,
    );
    const routedToName =
      status === 'pending_l2' ? EXPENSE_L2_APPROVER_NAME : EXPENSE_L1_APPROVER_NAME;
    const id = `exp_${this.nextId++}`;

    const expense: Expense = {
      id,
      submitterId: actor.userId,
      submitterName: actor.displayName,
      categoryId: category.id,
      categoryLabel: category.label,
      merchant: request.merchant,
      amount: { ...request.amount },
      submittedDate: new Date(this.clock()).toISOString().slice(0, 10),
      status,
      ...(request.receiptFilename ? { receiptFilename: request.receiptFilename } : {}),
      ...(policyFlagged ? { policyFlagged: true } : {}),
      routedToName,
    };
    this.expenses.set(id, expense);

    // Join the approval queue so an approver can act on it (AC-01). The queue item is the approver's
    // projection of this expense — only the fields the queue shows, plus the scrutiny flag (AC-03).
    this.approvals.enqueue({
      id,
      submitterId: actor.userId,
      submitterName: actor.displayName,
      category: category.label,
      amount: { ...request.amount },
      submittedDate: expense.submittedDate,
      status,
      ...(policyFlagged ? { policyFlagged: true } : {}),
    });

    return { outcome: 'ok', expense: { ...expense, amount: { ...expense.amount } } };
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
