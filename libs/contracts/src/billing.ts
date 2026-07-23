import type { Money } from './money';

/** Whether the subscription bills monthly or annually. */
export type BillingCycle = 'monthly' | 'annual';

/**
 * The subscription's lifecycle state. `active`: normal, billing continues. `canceled_grace`: cancelled
 * but the paid period hasn't ended — read-only access remains until `accessUntil`, no new financial
 * objects can be created (US-CW-042 AC-07).
 */
export type SubscriptionStatus = 'active' | 'canceled_grace';

/** One usage line — how much of a plan allowance is consumed this period (US-CW-042 AC-01). */
export interface UsageMetric {
  used: number;
  limit: number;
}

/**
 * The masked payment method on file (US-CW-042 AC-02). Only the brand + last four + expiry are ever
 * held — the full PAN never reaches Clearline (Stripe hosted fields, PCI scope reduction).
 */
export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** A past invoice, downloadable as a period-named PDF (US-CW-042 AC-04). */
export interface InvoiceSummary {
  id: string;
  /** Billing period, `YYYY-MM` — used in the row label and the download filename. */
  period: string;
  /** ISO-8601 date the invoice was issued. */
  issuedAt: string;
  amount: Money;
}

/** GET /api/billing — the Billing & Plan summary an Admin/Owner sees (US-CW-042 AC-01). */
export interface BillingSummary {
  planName: string;
  cycle: BillingCycle;
  /** The organization's legal name — what the cancellation flow requires typed exactly (AC-05). */
  companyName: string;
  /** ISO-8601 date of the next charge; while `canceled_grace`, the date access ends. */
  nextBillingDate: string;
  amountDue: Money;
  usage: {
    members: UsageMetric;
    cards: UsageMetric;
    transactions: UsageMetric;
  };
  paymentMethod: PaymentMethodSummary | null;
  /** Past invoices, newest first — each downloadable as a period-named PDF (AC-04). */
  invoices: InvoiceSummary[];
  status: SubscriptionStatus;
  /** When `canceled_grace`: the date read-only access ends. Null while active. */
  accessUntil: string | null;
}

/**
 * POST /api/billing/payment-method — swap the card on file (US-CW-042 AC-02). The body carries a mock
 * Stripe Elements token, never raw card data. A token of `tok_declined` simulates a decline (AC-03).
 */
export interface UpdatePaymentMethodRequest {
  paymentToken: string;
}

export interface UpdatePaymentMethodResponse {
  paymentMethod: PaymentMethodSummary;
}

/**
 * POST /api/billing/cancel — schedule cancellation for period-end (US-CW-042 AC-05/AC-06). The exact
 * company name must be typed to confirm; a mismatch is rejected and nothing is cancelled.
 */
export interface CancelSubscriptionRequest {
  confirmationName: string;
}

export interface CancelSubscriptionResponse {
  status: SubscriptionStatus;
  /** ISO-8601 date read-only access ends — the end of the current paid period. */
  accessUntil: string;
}

/**
 * Body of a 4xx from a billing endpoint. `forbidden_role`: caller isn't an Admin/Owner (AC-08).
 * `card_declined`: the new card was declined; the existing method is unchanged (AC-03).
 * `name_mismatch`: the typed company name didn't match, so nothing was cancelled (AC-05).
 */
export interface BillingErrorResponse {
  error: 'forbidden_role' | 'card_declined' | 'name_mismatch';
}
