import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_DECLINE_TOKEN, DEMO_PAYMENT_TOKEN } from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Billing & Plan demo guide (US-CW-042). Registered by BillingPage so it overrides the layout-level
 * settings guide while mounted. It hands over the mock Stripe tokens and walks the approaching-limit
 * indicator, the payment-method update (including a decline), invoice download, and the
 * type-the-company-name cancellation. Admin/Owner-only: a Controller/Employee never sees this section.
 */
export const billingBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.billing',
  title: 'Billing & Plan',
  summary:
    'See your **plan & usage** (with an amber approaching-limit indicator), update the **payment ' +
    'method** via Stripe-style hosted fields, **download invoices**, and **cancel** through a ' +
    'type-the-company-name flow that keeps read-only access until period-end.',
  sections: [
    {
      kind: 'copyable',
      title: 'Mock Stripe tokens',
      items: [
        { label: 'Card that succeeds', value: DEMO_PAYMENT_TOKEN },
        { label: 'Card that is declined', value: DEMO_DECLINE_TOKEN },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'usage',
          title: 'Plan, usage & approaching-limit',
          steps: [
            {
              text: 'The **Transactions this period** row is seeded near its limit, so it shows an amber **Approaching limit** badge — an icon **and** text, never colour alone (AC-01).',
            },
          ],
        },
        {
          id: 'payment',
          title: 'Update the payment method',
          steps: [
            {
              text: 'Click **Update payment method**, paste the success token above, and **Save card** — the masked card updates. Card data never touches Clearline (hosted fields, AC-02).',
            },
            {
              text: `Try the declined token (\`${DEMO_DECLINE_TOKEN}\`) — you get **Your card was declined.** and the existing card is unchanged (AC-03).`,
            },
          ],
        },
        {
          id: 'invoices-cancel',
          title: 'Invoices & cancellation',
          steps: [
            {
              text: 'Click **Download** on any invoice — it downloads a period-named PDF (e.g. `clearline-invoice-2026-06.pdf`, AC-04).',
            },
            {
              text: 'Click **Cancel subscription** → **Continue** to see exactly what is lost, then type your company name **exactly** to enable the final button (AC-05). Cancellation is scheduled for period-end, and the app drops into read-only with a persistent banner (AC-06/07).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
