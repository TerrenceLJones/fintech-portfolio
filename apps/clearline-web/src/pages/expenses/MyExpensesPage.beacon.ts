import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { SEED_MY_EXPENSES } from '@clearline/mock-backend/fixtures';
import { money } from '../../dev/beacon/shared';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * My Expenses guide. The list is already on the page, so the Beacon mirrors the seeded rows (with
 * their lifecycle state) and points testers to "+ New expense" to start the submission flow.
 */
export const myExpensesBeacon: DemoBeaconPageConfig = {
  pageId: 'expenses.list',
  title: 'My Expenses',
  summary:
    'Your submitted expenses and their approval status. Start a new one with “+ New expense”.',
  sections: [
    {
      kind: 'entities',
      title: 'Seeded expenses',
      columns: [
        { key: 'merchant', label: 'Merchant' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ],
      rows: SEED_MY_EXPENSES.map((expense) => ({
        merchant: expense.merchant,
        category: expense.categoryLabel,
        amount: money(expense.amount),
        status: expense.status,
      })),
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'new',
          title: 'Submit a new expense',
          navigateTo: '/expenses/new',
          steps: [
            { text: 'Click **“+ New expense”** to open the submission form.' },
            { text: 'Follow the New Expense guide for the happy path and the policy scenarios.' },
          ],
        },
      ],
    },
    resetSection,
  ],
};
