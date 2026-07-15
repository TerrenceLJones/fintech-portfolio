import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { EXPENSE_CURRENCY, SEED_EXPENSE_CATEGORIES } from '@clearline/mock-backend/fixtures';
import { money } from '../../dev/beacon/shared';
import { resetSection } from '../../dev/beacon/global.beacon';

/** The category the AC-03 policy-limit scenario uses — Software, with a $200.00 per-transaction limit. */
const softwareLimit = SEED_EXPENSE_CATEGORIES.find(
  (c) => c.id === 'software',
)?.perTransactionLimitMinorUnits;

/**
 * New-expense guide. Walks a tester through the three US-CW-011 scenarios — the happy path, the
 * receipt-required hard block over $75, and the advisory category policy-limit warning that flags but
 * still submits.
 */
export const newExpenseBeacon: DemoBeaconPageConfig = {
  pageId: 'expenses.new',
  title: 'New expense',
  summary:
    'Submit an expense with an amount, category, merchant and receipt. Policy checks surface in real time, before submit.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'happy',
          title: 'Submit a clean expense (happy path)',
          steps: [
            {
              text: 'Enter amount **$300**, category **Travel**, a merchant, and attach a receipt.',
            },
            { text: 'Click **Submit for approval** — it routes to an approver and confirms.' },
          ],
        },
        {
          id: 'receipt-required',
          title: 'Receipt required over $75 (hard block)',
          steps: [
            { text: 'Enter **$120**, category **Meals**, and leave the receipt empty.' },
            {
              text: 'The receipt error appears and submit stays blocked until you attach one (AC-02).',
            },
          ],
        },
        {
          id: 'policy-warning',
          title: 'Policy-limit warning (soft block)',
          steps: [
            {
              text: `Enter **$350** in **Software** — over the ${
                softwareLimit
                  ? money({ amountMinorUnits: softwareLimit, currency: EXPENSE_CURRENCY })
                  : '$200.00'
              } category limit.`,
            },
            {
              text: 'A warning appears, but you can still **Submit anyway** — it is flagged for scrutiny (AC-03).',
            },
          ],
        },
      ],
    },
    {
      kind: 'text',
      title: 'What the policy checks are',
      body: `A receipt is required for expenses **over $75.00** (blocks submit). Each category may carry a per-transaction limit (**Software $200.00**) — exceeding it only **warns** and flags the expense; it never blocks submission.`,
    },
    resetSection,
  ],
};
