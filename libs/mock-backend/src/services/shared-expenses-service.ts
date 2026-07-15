import { ExpensesService } from './expenses.service';
import { SEED_EXPENSE_CATEGORIES, SEED_MY_EXPENSES } from '../fixtures/expenses.fixture';
import { sharedApprovalsService } from './shared-approvals-service';

/**
 * The one ExpensesService the running app's expense handlers bind to. It shares the single
 * sharedApprovalsService instance the approval handlers use, so an expense submitted here immediately
 * shows up in the approver's queue (US-CW-011 AC-01) and an approver's decision flips the submitter's
 * My Expenses view (US-CW-012 AC-02). Like the queue, state resets to the seed fixtures on a full page
 * reload — fine for a demo; tests inject their own isolated instances via the handler factory.
 */
export const sharedExpensesService = new ExpensesService(
  SEED_MY_EXPENSES,
  SEED_EXPENSE_CATEGORIES,
  sharedApprovalsService,
);
