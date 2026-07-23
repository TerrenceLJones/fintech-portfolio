import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { BillingSummary } from '@clearline/contracts';
import { createBillingHandlers } from './billing.handlers';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { BillingService } from '../services/billing.service';
import { DEMO_DECLINE_TOKEN, DEMO_USER_PASSWORD } from '../fixtures';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://billing-test.example';

let authService: AuthService;
let auditService: AuditService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  auditService = new AuditService([]);
  // An isolated BillingService per test so a cancellation in one case can't leak into another.
  server.use(...createBillingHandlers(new BillingService(), authService, auditService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

describe('GET /api/billing (US-CW-042 AC-01/AC-08)', () => {
  it('returns the summary for an Admin/Owner', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as BillingSummary;
    expect(body.planName).toBe('Growth');
    expect(body.usage.transactions.used).toBe(920);
    expect(body.companyName).toBeTruthy();
  });

  it('rejects a plain Employee with 403 (server decides, regardless of client)', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) });
    expect(response.status).toBe(403);
  });

  it('rejects a Finance Manager who is not an Admin/Owner with 403', async () => {
    const token = await loginAs('demo@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) });
    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const response = await fetch(`${ORIGIN}/api/billing`);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/billing/status (US-CW-042 AC-07)', () => {
  it('is readable by any authenticated user, even a non-admin, for the grace banner', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing/status`, { headers: auth(token) });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('active');
  });
});

describe('POST /api/billing/payment-method (US-CW-042 AC-02/AC-03/AC-09)', () => {
  it('updates the masked card and audits without any raw card data', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing/payment-method`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ paymentToken: 'tok_mastercard_1117' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).paymentMethod.last4).toBe('1117');

    const [event] = auditService.list();
    expect(event!.category).toBe('billing');
    expect(event!.action).toContain('Updated payment method');
    // Never records raw card data — only the masked brand + last four.
    expect(JSON.stringify(event)).not.toContain('tok_mastercard_1117');
  });

  it('surfaces a declined card as 402 and leaves the method unchanged (AC-03)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const before = (await (
      await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) })
    ).json()) as BillingSummary;

    const response = await fetch(`${ORIGIN}/api/billing/payment-method`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ paymentToken: DEMO_DECLINE_TOKEN }),
    });
    expect(response.status).toBe(402);
    expect((await response.json()).error).toBe('card_declined');

    const after = (await (
      await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) })
    ).json()) as BillingSummary;
    expect(after.paymentMethod).toEqual(before.paymentMethod);
  });
});

describe('POST /api/billing/cancel (US-CW-042 AC-05/AC-06)', () => {
  it('rejects a mismatched company name and cancels nothing (AC-05)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing/cancel`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ confirmationName: 'Not The Company' }),
    });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe('name_mismatch');
    const summary = (await (
      await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) })
    ).json()) as BillingSummary;
    expect(summary.status).toBe('active');
  });

  it('schedules cancellation for period-end when the exact name is typed (AC-06)', async () => {
    const token = await loginAs('owner@clearline.dev');
    const summary = (await (
      await fetch(`${ORIGIN}/api/billing`, { headers: auth(token) })
    ).json()) as BillingSummary;

    const response = await fetch(`${ORIGIN}/api/billing/cancel`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ confirmationName: summary.companyName }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('canceled_grace');
    expect(body.accessUntil).toBe(summary.nextBillingDate);
    expect(auditService.list()[0]!.action).toContain('Cancelled subscription');
  });
});

describe('GET /api/billing/invoices/:id/pdf (US-CW-042 AC-04)', () => {
  it('downloads a period-named PDF', async () => {
    const token = await loginAs('owner@clearline.dev');
    const response = await fetch(`${ORIGIN}/api/billing/invoices/inv_2026-06/pdf`, {
      headers: auth(token),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('clearline-invoice-2026-06.pdf');
  });
});
