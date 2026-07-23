import { beforeEach, describe, expect, it } from 'vitest';
import { BillingService } from './billing.service';
import { DEMO_DECLINE_TOKEN, SEED_ORGANIZATION } from '../fixtures';

const ORG_ID = SEED_ORGANIZATION.id;
const COMPANY = 'Clearline Demo Co';

let billing: BillingService;
beforeEach(() => {
  billing = new BillingService();
});

describe('BillingService.snapshot (US-CW-042 AC-01)', () => {
  it('returns the plan, usage, masked card, and the passed-in company name', () => {
    const summary = billing.snapshot(ORG_ID, COMPANY);
    expect(summary.planName).toBe('Growth');
    expect(summary.companyName).toBe(COMPANY);
    expect(summary.amountDue).toEqual({ amountMinorUnits: 49900, currency: 'USD' });
    expect(summary.usage.transactions).toEqual({ used: 920, limit: 1000 });
    expect(summary.paymentMethod).toMatchObject({ brand: 'visa', last4: '4242' });
    expect(summary.status).toBe('active');
  });
});

describe('BillingService.updatePaymentMethod (US-CW-042 AC-02/AC-03)', () => {
  it('swaps the card on a valid token, deriving only a masked brand + last four', () => {
    const result = billing.updatePaymentMethod(ORG_ID, 'tok_mastercard_1117');
    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.paymentMethod.brand).toBe('mastercard');
      expect(result.paymentMethod.last4).toBe('1117');
    }
    expect(billing.snapshot(ORG_ID, COMPANY).paymentMethod?.last4).toBe('1117');
  });

  it('refuses a declined token and leaves the existing method unchanged (AC-03)', () => {
    const before = billing.snapshot(ORG_ID, COMPANY).paymentMethod;
    const result = billing.updatePaymentMethod(ORG_ID, DEMO_DECLINE_TOKEN);
    expect(result.outcome).toBe('declined');
    expect(billing.snapshot(ORG_ID, COMPANY).paymentMethod).toEqual(before);
  });
});

describe('BillingService.cancelSubscription (US-CW-042 AC-06/AC-07)', () => {
  it('schedules cancellation for period-end and drops the org into read-only grace', () => {
    expect(billing.isReadOnly(ORG_ID)).toBe(false);
    const result = billing.cancelSubscription(ORG_ID);
    expect(result.accessUntil).toBe('2026-08-01'); // the next billing date, not immediate
    const summary = billing.snapshot(ORG_ID, COMPANY);
    expect(summary.status).toBe('canceled_grace');
    expect(summary.accessUntil).toBe('2026-08-01');
    expect(billing.isReadOnly(ORG_ID)).toBe(true);
  });

  it('is idempotent — a second cancel reports the same grace end', () => {
    const first = billing.cancelSubscription(ORG_ID);
    const second = billing.cancelSubscription(ORG_ID);
    expect(second.outcome).toBe('already_canceled');
    expect(second.accessUntil).toBe(first.accessUntil);
  });
});

describe('BillingService.invoicePdf (US-CW-042 AC-04)', () => {
  it('names the file with the billing period', () => {
    const pdf = billing.invoicePdf(ORG_ID, 'inv_2026-06');
    expect(pdf?.filename).toBe('clearline-invoice-2026-06.pdf');
    expect(pdf?.bytes.byteLength).toBeGreaterThan(0);
  });

  it('returns null for an unknown invoice', () => {
    expect(billing.invoicePdf(ORG_ID, 'inv_nope')).toBeNull();
  });
});
