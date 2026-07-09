import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { CreatePaymentRequest } from '@clearline/contracts';
import { createPaymentsHandlers } from './payments.handlers';
import { AuthService } from '../services/auth.service';
import { PaymentsService } from '../services/payments.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

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
});
