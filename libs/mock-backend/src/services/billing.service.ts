import type {
  BillingCycle,
  BillingSummary,
  InvoiceSummary,
  PaymentMethodSummary,
  SubscriptionStatus,
} from '@clearline/contracts';
import { DEMO_DECLINE_TOKEN, SEED_BILLING, type SeedBilling } from '../fixtures/billing.fixture';

interface StoredBilling {
  planName: string;
  cycle: BillingCycle;
  nextBillingDate: string;
  amountDueMinor: number;
  currency: string;
  usage: SeedBilling['usage'];
  paymentMethod: PaymentMethodSummary;
  invoices: InvoiceSummary[];
  status: SubscriptionStatus;
  accessUntil: string | null;
}

export type UpdatePaymentMethodResult =
  { outcome: 'ok'; paymentMethod: PaymentMethodSummary } | { outcome: 'declined' };

export type CancelSubscriptionResult =
  { outcome: 'ok'; accessUntil: string } | { outcome: 'already_canceled'; accessUntil: string };

export interface InvoicePdf {
  filename: string;
  bytes: Uint8Array;
}

/**
 * In-memory Billing & Plan backend for US-CW-042. Each org owns a plan, usage counters, a masked card,
 * an invoice history, and a subscription status. The doctrine it enforces: raw card data never reaches
 * the service — a payment-method update takes an opaque mock Stripe token and derives only a masked
 * brand + last four (PCI scope reduction); a token of `tok_declined` is refused and leaves the existing
 * method intact (AC-03). Cancellation is scheduled for period-end, dropping the org into a read-only
 * grace window rather than cutting access immediately (AC-06/07). State is per-instance: the app binds
 * the shared singleton; tests construct isolated instances.
 */
export class BillingService {
  private readonly orgs = new Map<string, StoredBilling>();

  constructor(seed: readonly SeedBilling[] = SEED_BILLING) {
    for (const record of seed) {
      this.orgs.set(record.orgId, {
        planName: record.planName,
        cycle: record.cycle,
        nextBillingDate: record.nextBillingDate,
        amountDueMinor: record.amountDueMinor,
        currency: record.currency,
        usage: {
          members: { ...record.usage.members },
          cards: { ...record.usage.cards },
          transactions: { ...record.usage.transactions },
        },
        paymentMethod: { ...record.paymentMethod },
        invoices: record.invoices.map((i) => ({ ...i })),
        status: 'active',
        accessUntil: null,
      });
    }
  }

  /** The org's plan/usage/payment/invoice summary (AC-01). `companyName` is supplied live by the handler. */
  snapshot(orgId: string, companyName: string): BillingSummary {
    const store = this.ensure(orgId);
    return {
      planName: store.planName,
      cycle: store.cycle,
      companyName,
      nextBillingDate: store.nextBillingDate,
      amountDue: { amountMinorUnits: store.amountDueMinor, currency: store.currency },
      usage: {
        members: { ...store.usage.members },
        cards: { ...store.usage.cards },
        transactions: { ...store.usage.transactions },
      },
      paymentMethod: { ...store.paymentMethod },
      invoices: store.invoices.map((i) => ({ ...i })),
      status: store.status,
      accessUntil: store.accessUntil,
    };
  }

  /** Just the subscription status + grace end — for the app-wide read-only banner, readable by any role (AC-07). */
  status(orgId: string): { status: SubscriptionStatus; accessUntil: string | null } {
    const store = this.ensure(orgId);
    return { status: store.status, accessUntil: store.accessUntil };
  }

  /** Whether the org is in the post-cancellation read-only window — no new financial objects (AC-07). */
  isReadOnly(orgId: string): boolean {
    return this.ensure(orgId).status === 'canceled_grace';
  }

  /**
   * Swap the card on file from an opaque mock Stripe token (AC-02). `tok_declined` is refused and the
   * existing method is left untouched (AC-03). No raw PAN is ever received — the masked brand/last-four
   * are derived from the token so the demo never handles card data.
   */
  updatePaymentMethod(orgId: string, token: string): UpdatePaymentMethodResult {
    if (token === DEMO_DECLINE_TOKEN) return { outcome: 'declined' };
    const store = this.ensure(orgId);
    store.paymentMethod = derivePaymentMethod(token);
    return { outcome: 'ok', paymentMethod: { ...store.paymentMethod } };
  }

  /**
   * Schedule cancellation for the end of the current paid period (AC-06). The org drops into a
   * `canceled_grace` window with read-only access until `nextBillingDate`, rather than losing access
   * now. Idempotent: cancelling an already-cancelled subscription reports the same grace end.
   */
  cancelSubscription(orgId: string): CancelSubscriptionResult {
    const store = this.ensure(orgId);
    if (store.status === 'canceled_grace' && store.accessUntil) {
      return { outcome: 'already_canceled', accessUntil: store.accessUntil };
    }
    store.status = 'canceled_grace';
    store.accessUntil = store.nextBillingDate;
    return { outcome: 'ok', accessUntil: store.accessUntil };
  }

  /** The PDF bytes + period-named filename for one invoice (AC-04), or null if it's unknown. */
  invoicePdf(orgId: string, invoiceId: string): InvoicePdf | null {
    const invoice = this.ensure(orgId).invoices.find((i) => i.id === invoiceId);
    if (!invoice) return null;
    return {
      filename: `clearline-invoice-${invoice.period}.pdf`,
      bytes: mockInvoicePdfBytes(invoice),
    };
  }

  private ensure(orgId: string): StoredBilling {
    let store = this.orgs.get(orgId);
    if (!store) {
      // A never-seeded org (created at runtime) gets a minimal active default so the surface still works.
      store = {
        planName: 'Growth',
        cycle: 'monthly',
        nextBillingDate: '2026-08-01',
        amountDueMinor: 49900,
        currency: 'USD',
        usage: {
          members: { used: 1, limit: 25 },
          cards: { used: 0, limit: 50 },
          transactions: { used: 0, limit: 1000 },
        },
        paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2028 },
        invoices: [],
        status: 'active',
        accessUntil: null,
      };
      this.orgs.set(orgId, store);
    }
    return store;
  }
}

/** Derive a masked card from an opaque token — the demo never receives a real PAN. */
function derivePaymentMethod(token: string): PaymentMethodSummary {
  // The last four digits in the token, if any, stand in for the new card's last four.
  const digits = token.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : '4242';
  const brand = /amex/i.test(token) ? 'amex' : /master/i.test(token) ? 'mastercard' : 'visa';
  return { brand, last4, expMonth: 12, expYear: 2030 };
}

/** A tiny, valid-enough PDF byte payload naming the invoice — stands in for a rendered invoice (AC-04). */
function mockInvoicePdfBytes(invoice: InvoiceSummary): Uint8Array {
  const text = `%PDF-1.4\n% Clearline invoice ${invoice.period} — mock document\n`;
  return new TextEncoder().encode(text);
}
