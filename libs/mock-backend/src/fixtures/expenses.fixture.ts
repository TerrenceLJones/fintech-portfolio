import type { Expense, ExpenseCategory } from '@clearline/contracts';

/** The demo organization's single expense currency (ISO 4217). Expenses carry no FX (unlike payments). */
export const EXPENSE_CURRENCY = 'USD';

/**
 * Spend categories for the New Expense form. `Software` carries the $200.00 per-transaction policy
 * limit the US-CW-011 AC-03 scenario exercises (a $350.00 software expense warns but still submits).
 * Amounts are USD minor units (cents).
 */
export const SEED_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'travel', label: 'Travel' },
  { id: 'meals', label: 'Meals', perTransactionLimitMinorUnits: 7_500 },
  { id: 'software', label: 'Software', perTransactionLimitMinorUnits: 20_000 },
  { id: 'equipment', label: 'Equipment' },
  { id: 'office', label: 'Office', perTransactionLimitMinorUnits: 50_000 },
];

/**
 * The demo account's (`user_1`, Marcus Okafor) own submitted expenses, so the My Expenses list isn't
 * empty on first load. A mix of lifecycle states — one still pending L2, one approved, one rejected
 * with a reason — so the status column and rejection-reason surface both have something to show.
 */
export const SEED_MY_EXPENSES: Expense[] = [
  {
    id: 'exp_4490',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    categoryId: 'travel',
    categoryLabel: 'Travel',
    merchant: 'United Airlines — DEN→SFO',
    amount: { amountMinorUnits: 124_000, currency: 'USD' },
    submittedDate: '2026-06-24',
    status: 'pending_l2',
    receiptFilename: 'receipt-ua-den.jpg',
    routedToName: 'Sofia Whitman',
  },
  {
    id: 'exp_4455',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    categoryId: 'meals',
    categoryLabel: 'Meals',
    merchant: 'Blue Bottle Coffee',
    amount: { amountMinorUnits: 5_400, currency: 'USD' },
    submittedDate: '2026-06-20',
    status: 'approved',
    routedToName: 'Sofia Whitman',
  },
  {
    id: 'exp_4402',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    categoryId: 'software',
    categoryLabel: 'Software',
    merchant: 'JetBrains',
    amount: { amountMinorUnits: 35_000, currency: 'USD' },
    submittedDate: '2026-06-12',
    status: 'rejected',
    receiptFilename: 'invoice-jetbrains.pdf',
    policyFlagged: true,
    rejectionReason:
      'Exceeds the $200.00 Software policy limit — please split or request an exception.',
  },
  // The Employee demo account (user_2, Theo Alvarez), so signing in as the Employee lands on a
  // populated My Expenses rather than an empty state.
  {
    id: 'exp_4300',
    submitterId: 'user_2',
    submitterName: 'Theo Alvarez',
    categoryId: 'travel',
    categoryLabel: 'Travel',
    merchant: 'Amtrak — NYP→BOS',
    amount: { amountMinorUnits: 8_900, currency: 'USD' },
    submittedDate: '2026-06-30',
    status: 'pending_l1',
    receiptFilename: 'amtrak-nyp-bos.pdf',
    routedToName: 'Marcus Okafor',
  },
  {
    id: 'exp_4288',
    submitterId: 'user_2',
    submitterName: 'Theo Alvarez',
    categoryId: 'meals',
    categoryLabel: 'Meals',
    merchant: 'Sweetgreen',
    amount: { amountMinorUnits: 4_200, currency: 'USD' },
    submittedDate: '2026-06-22',
    status: 'approved',
    routedToName: 'Marcus Okafor',
  },
];

/** The approver a submitted expense is routed to, by tier — shown in the submission confirmation. */
export const EXPENSE_L1_APPROVER_NAME = 'Marcus Okafor';
export const EXPENSE_L2_APPROVER_NAME = 'Sofia Whitman';
