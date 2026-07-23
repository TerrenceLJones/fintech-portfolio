import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { CreatePaymentRequest } from '@clearline/contracts';
import { createPaymentsHandlers } from './payments.handlers';
import { AuthService } from '../services/auth.service';
import { PaymentsService } from '../services/payments.service';
import { BillingService } from '../services/billing.service';
import { SEED_USERS, SEED_ORGANIZATION, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const [user] = SEED_USERS;
const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://payments-test.example';

let authService: AuthService;
let paymentsService: PaymentsService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  paymentsService = new PaymentsService();
  server.use(...createPaymentsHandlers(paymentsService, authService));
});

async function login(): Promise<string> {
  const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function pay(body: CreatePaymentRequest, token: string, key = 'key-1') {
  return fetch(`${ORIGIN}/api/payments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': key,
    },
    body: JSON.stringify(body),
  });
}

const acme: CreatePaymentRequest = {
  recipientId: 'rec_acme',
  amount: { amountMinorUnits: 500_000, currency: 'USD' },
  method: 'ach',
};

/** $12,000 to Acme — above the step-up threshold. */
const highValue: CreatePaymentRequest = {
  recipientId: 'rec_acme',
  amount: { amountMinorUnits: 1_200_000, currency: 'USD' },
  method: 'ach',
};

function verify(intentId: string, code: string, token: string) {
  return fetch(`${ORIGIN}/api/payments/${intentId}/challenge/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

function resend(intentId: string, token: string, body: Record<string, unknown> = {}) {
  return fetch(`${ORIGIN}/api/payments/${intentId}/challenge/resend`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/payments/context', () => {
  it('returns the source account and recipients for an authorized caller', async () => {
    const token = await login();
    const response = await fetch(`${ORIGIN}/api/payments/context`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source.maskedAccount).toBe('••4021');
    expect(body.recipients.map((r: { id: string }) => r.id)).toContain('rec_acme');
    // Internal-only fields never leak to the wire.
    expect(body.recipients[0]).not.toHaveProperty('accountNumber');
  });

  it('returns 401 without a token and 403 for a role lacking payments:create', async () => {
    expect((await fetch(`${ORIGIN}/api/payments/context`)).status).toBe(401);
    const token = await login();
    authService.setUserRole(user!.email, { role: 'employee', approvalLimit: null });
    const response = await fetch(`${ORIGIN}/api/payments/context`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});

describe('POST /api/payments', () => {
  it('creates a pending payment and echoes the intent', async () => {
    const token = await login();
    const response = await pay(acme, token);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.intent.status).toBe('pending');
  });

  it('requires an Idempotency-Key header', async () => {
    const token = await login();
    const response = await fetch(`${ORIGIN}/api/payments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(acme),
    });
    expect(response.status).toBe(400);
  });

  it('is exactly-once for a replayed key and returns the same intent', async () => {
    const token = await login();
    const first = await (await pay(acme, token, 'dupe')).json();
    const second = await (await pay(acme, token, 'dupe')).json();
    expect(second.intent.id).toBe(first.intent.id);
  });

  it('returns 409 for the same key with a changed payload', async () => {
    const token = await login();
    await pay(acme, token, 'dupe');
    const response = await pay(
      { ...acme, amount: { amountMinorUnits: 525_000, currency: 'USD' } },
      token,
      'dupe',
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'idempotency_mismatch' });
  });

  it('returns 422 with the reason for a closed recipient', async () => {
    const token = await login();
    const response = await pay({ ...acme, recipientId: 'rec_vertex' }, token);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'recipient_closed' });
  });

  it('rejects a non-positive amount the client would never submit (server boundary)', async () => {
    const token = await login();
    const response = await pay(
      { ...acme, amount: { amountMinorUnits: 0, currency: 'USD' } },
      token,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'invalid_amount' });
  });
});

describe('POST /api/payments — step-up threshold (US-CW-010 AC-01)', () => {
  it('returns a requires_action intent with a challenge for a high-value payment', async () => {
    const token = await login();
    const response = await pay(highValue, token);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.intent.status).toBe('requires_action');
    expect(body.challenge.intentId).toBe(body.intent.id);
    expect(body.challenge.destinationMasked).toBeTruthy();
    // The OTP code itself never crosses the wire.
    expect(body.challenge).not.toHaveProperty('code');
  });
});

describe('POST /api/payments/:id/challenge/verify (US-CW-010)', () => {
  async function reserve(token: string): Promise<string> {
    const body = await (await pay(highValue, token, 'hv-key')).json();
    return body.intent.id;
  }

  it('commits the payment on the correct code (AC-02)', async () => {
    const token = await login();
    const intentId = await reserve(token);
    const response = await verify(intentId, '424242', token);
    expect(response.status).toBe(200);
    expect((await response.json()).intent.status).toBe('pending');
  });

  it('returns 422 otp_incorrect for a wrong code (AC-04)', async () => {
    const token = await login();
    const intentId = await reserve(token);
    const response = await verify(intentId, '111111', token);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'otp_incorrect' });
  });

  it('returns 422 otp_expired with a fresh challenge for an expired code (AC-06)', async () => {
    const token = await login();
    const intentId = await reserve(token);
    const response = await verify(intentId, '000000', token);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe('otp_expired');
    expect(body.challenge.intentId).toBe(intentId);
  });

  it('404s an unknown intent and 401s without a token', async () => {
    const token = await login();
    expect((await verify('pi_missing', '424242', token)).status).toBe(404);
    const noAuth = await fetch(`${ORIGIN}/api/payments/pi_x/challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '424242' }),
    });
    expect(noAuth.status).toBe(401);
  });
});

describe('POST /api/payments/:id/challenge/resend (US-CW-010 AC-05)', () => {
  it('issues a fresh challenge and can switch the delivery method', async () => {
    const token = await login();
    const intentId = (await (await pay(highValue, token, 'hv-key')).json()).intent.id;

    const sms = await resend(intentId, token);
    expect(sms.status).toBe(200);
    expect((await sms.json()).challenge.method).toBe('otp_sms');

    const email = await resend(intentId, token, { method: 'otp_email' });
    expect((await email.json()).challenge.method).toBe('otp_email');
  });

  it('404s an unknown intent', async () => {
    const token = await login();
    expect((await resend('pi_missing', token)).status).toBe(404);
  });
});

describe('GET /api/payments/:id', () => {
  it('returns a seeded intent and 404 for an unknown id', async () => {
    const token = await login();
    const ok = await fetch(`${ORIGIN}/api/payments/pi_settled`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).intent.status).toBe('settled');

    const missing = await fetch(`${ORIGIN}/api/payments/pi_missing`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missing.status).toBe(404);
  });

  it('returns 401 without a token and 403 for a role lacking payments:create', async () => {
    expect((await fetch(`${ORIGIN}/api/payments/pi_settled`)).status).toBe(401);
    const token = await login();
    authService.setUserRole(user!.email, { role: 'employee', approvalLimit: null });
    const response = await fetch(`${ORIGIN}/api/payments/pi_settled`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});

describe('POST /api/payments/:id/reverse (webhook)', () => {
  it('reverses a payment and 404s an unknown intent', async () => {
    const response = await fetch(`${ORIGIN}/api/payments/pi_settled/reverse`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect((await response.json()).intent.status).toBe('reversed');

    const missing = await fetch(`${ORIGIN}/api/payments/pi_missing/reverse`, { method: 'POST' });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/payments/fx', () => {
  it('returns a converted amount for a supported pair and 404 otherwise', async () => {
    const token = await login();
    const ok = await fetch(`${ORIGIN}/api/payments/fx?from=USD&to=EUR&amount=500000`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).convertedAmount.amountMinorUnits).toBe(459_000);

    const unsupported = await fetch(`${ORIGIN}/api/payments/fx?from=USD&to=ZZZ&amount=500000`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(unsupported.status).toBe(404);
  });

  it('returns 401 without a token and 403 for a role lacking payments:create', async () => {
    const url = `${ORIGIN}/api/payments/fx?from=USD&to=EUR&amount=500000`;
    expect((await fetch(url)).status).toBe(401);
    const token = await login();
    authService.setUserRole(user!.email, { role: 'employee', approvalLimit: null });
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});

describe('post-cancellation read-only grace (US-CW-042 AC-07)', () => {
  it('blocks creating a new payment once the org subscription is cancelled', async () => {
    const billing = new BillingService();
    billing.cancelSubscription(SEED_ORGANIZATION.id);
    server.use(...createPaymentsHandlers(paymentsService, authService, undefined, billing));

    const token = await login();
    const response = await pay(acme, token);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('subscription_canceled');
  });
});
