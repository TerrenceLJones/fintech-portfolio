/**
 * Seed data for Billing & Plan (US-CW-042). There is no real Stripe, invoicing, or usage-metering
 * backend in the demo — these constants stand in so the plan/usage summary, the approaching-limit
 * indicator, the payment-method update, the invoice history, and the cancellation flow can be exercised
 * deterministically. The "transactions" usage line is seeded near its limit ON PURPOSE so the amber
 * "Approaching limit" state (AC-01) shows out of the box. `DEMO_DECLINE_TOKEN` is the mock Stripe token
 * a tester enters to see a declined-card path (AC-03); raw card data never reaches the demo either.
 */
import type { BillingCycle, InvoiceSummary, PaymentMethodSummary } from '@clearline/contracts';
import { SEED_ORGANIZATION } from './users.fixture';

/** The mock Stripe Elements token that simulates a declined card (US-CW-042 AC-03). */
export const DEMO_DECLINE_TOKEN = 'tok_declined';

/** A mock Stripe token a tester can paste to swap in a known Visa ending 4242 (US-CW-042 AC-02). */
export const DEMO_PAYMENT_TOKEN = 'tok_visa_4242';

/** The full seed for one org's billing surface. */
export interface SeedBilling {
  orgId: string;
  planName: string;
  cycle: BillingCycle;
  nextBillingDate: string;
  amountDueMinor: number;
  currency: string;
  usage: {
    members: { used: number; limit: number };
    cards: { used: number; limit: number };
    transactions: { used: number; limit: number };
  };
  paymentMethod: PaymentMethodSummary;
  invoices: InvoiceSummary[];
}

function invoice(period: string, issuedAt: string, amountMinor: number): InvoiceSummary {
  return {
    id: `inv_${period}`,
    period,
    issuedAt,
    amount: { amountMinorUnits: amountMinor, currency: 'USD' },
  };
}

/**
 * The demo org's billing state: a Growth plan billed monthly, a card on file, three months of invoices,
 * and usage where transactions sit at 920/1000 so the approaching-limit indicator is visible (AC-01).
 */
export const SEED_BILLING: SeedBilling[] = [
  {
    orgId: SEED_ORGANIZATION.id,
    planName: 'Growth',
    cycle: 'monthly',
    nextBillingDate: '2026-08-01',
    amountDueMinor: 49900,
    currency: 'USD',
    usage: {
      members: { used: 4, limit: 25 },
      cards: { used: 12, limit: 50 },
      transactions: { used: 920, limit: 1000 },
    },
    paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2028 },
    invoices: [
      invoice('2026-07', '2026-07-01', 49900),
      invoice('2026-06', '2026-06-01', 49900),
      invoice('2026-05', '2026-05-01', 49900),
    ],
  },
];
