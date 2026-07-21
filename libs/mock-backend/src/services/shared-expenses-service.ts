import { DEFAULT_APPROVAL_TIERS } from '@clearline/domain-expenses';
import { ExpensesService, type ExpensePolicyProvider } from './expenses.service';
import { SEED_EXPENSE_CATEGORIES, SEED_MY_EXPENSES } from '../fixtures/expenses.fixture';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { sharedApprovalsService } from './shared-approvals-service';
import { sharedAuthService } from './shared-auth-service';

/**
 * Reads the *caller's* org's live approval + spend-control policy from the shared AuthService, so an edit
 * made in Settings → Approval Policies / Spend Controls (US-CW-037) changes routing and submission
 * enforcement here immediately — the one policy model, no divergent copy (AC-10). An unknown org (or a
 * caller with none) falls back to the seed org and then to the standard defaults.
 */
const sharedPolicyProvider: ExpensePolicyProvider = {
  approvalTiers: (orgId) =>
    sharedAuthService.getApprovalTiers(orgId || SEED_ORGANIZATION.id) ??
    DEFAULT_APPROVAL_TIERS.map((tier) => ({ ...tier })),
  spendControls: (orgId) =>
    sharedAuthService.getSpendControls(orgId || SEED_ORGANIZATION.id) ?? {
      receiptRequiredThresholdMinorUnits: 7_500,
      memoRequiredThresholdMinorUnits: 0,
      outOfPolicyBehavior: 'flag',
      categoryCaps: {},
    },
};

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
  () => Date.now(),
  sharedPolicyProvider,
);
