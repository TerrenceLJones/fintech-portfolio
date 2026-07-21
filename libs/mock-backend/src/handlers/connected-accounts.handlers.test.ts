import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  ConnectedAccountResponse,
  ConnectedAccountsResponse,
  VerifyMicroDepositsResponse,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { ConnectedAccountsService } from '../services/connected-accounts.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS } from '../fixtures/connected-accounts.fixture';
import { createConnectedAccountsHandlers } from './connected-accounts.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';
const ORG_ID = SEED_ORGANIZATION.id;

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;
let service: ConnectedAccountsService;

async function tokenFor(email: string): Promise<string> {
  const login = await authService.login(email, PASSWORD, '127.0.0.1');
  return login.accessToken!;
}

async function startWith() {
  const controller = await buildSeedUser({
    id: 'user_ctrl',
    email: 'controller@clearline.dev',
    password: PASSWORD,
    role: 'controller',
    orgId: ORG_ID,
  });
  const employee = await buildSeedUser({
    id: 'user_emp',
    email: 'employee@clearline.dev',
    password: PASSWORD,
    role: 'employee',
    orgId: ORG_ID,
  });
  authService = new AuthService([controller, employee]);
  auditService = new AuditService([]);
  service = new ConnectedAccountsService();
  server = setupServer(...createConnectedAccountsHandlers(service, authService, auditService));
  server.listen({ onUnhandledRequest: 'error' });
}

function auth(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  };
}

beforeEach(startWith);
afterEach(() => server?.close());

describe('GET /api/connected-accounts', () => {
  it('403s for an Employee without bank-accounts:manage (AC-09)', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(`${BASE}/api/connected-accounts`, auth(token));
    expect(res.status).toBe(403);
  });

  it('lists the seeded accounts for a Controller', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/connected-accounts`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ConnectedAccountsResponse;
    expect(body.accounts.length).toBeGreaterThan(0);
  });
});

describe('POST /api/connected-accounts/plaid (AC-04)', () => {
  it('connects a verified Plaid account and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/connected-accounts/plaid`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as ConnectedAccountResponse;
    expect(body.account.status).toBe('connected');
    expect(auditService.list()[0]!.category).toBe('connected_account');
  });
});

describe('manual connection + verification (AC-05/06)', () => {
  async function connectManual(token: string) {
    const res = await fetch(
      `${BASE}/api/connected-accounts/manual`,
      auth(token, {
        method: 'POST',
        body: JSON.stringify({ routingNumber: '021000021', accountNumber: '1234567890' }),
      }),
    );
    return res;
  }

  it('creates a pending account then verifies with the correct amounts', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const connect = await connectManual(token);
    expect(connect.status).toBe(201);
    const { account } = (await connect.json()) as ConnectedAccountResponse;
    expect(account.status).toBe('pending_verification');

    const verifyRes = await fetch(
      `${BASE}/api/connected-accounts/${account.id}/verify`,
      auth(token, {
        method: 'POST',
        body: JSON.stringify({ amountsMinorUnits: [...MICRO_DEPOSIT_AMOUNTS_MINOR_UNITS] }),
      }),
    );
    expect(verifyRes.status).toBe(200);
    const verify = (await verifyRes.json()) as VerifyMicroDepositsResponse;
    expect(verify.outcome).toBe('verified');
    expect(verify.account.status).toBe('connected');
  });

  it('returns mismatch with the remaining attempts on a wrong entry (AC-06)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const { account } = (await (await connectManual(token)).json()) as ConnectedAccountResponse;
    const verifyRes = await fetch(
      `${BASE}/api/connected-accounts/${account.id}/verify`,
      auth(token, { method: 'POST', body: JSON.stringify({ amountsMinorUnits: [1, 2] }) }),
    );
    const verify = (await verifyRes.json()) as VerifyMicroDepositsResponse;
    expect(verify.outcome).toBe('mismatch');
    expect(verify.attemptsRemaining).toBe(2);
  });

  it('rejects an invalid routing number (AC-05)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/connected-accounts/manual`,
      auth(token, {
        method: 'POST',
        body: JSON.stringify({ routingNumber: '123', accountNumber: '1234567890' }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_routing');
  });
});

describe('remove + reconnect (AC-07/08)', () => {
  it('removes an account and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/connected-accounts/acct_svb`,
      auth(token, { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    expect(auditService.list()[0]!.action).toContain('Removed');

    const list = (await (
      await fetch(`${BASE}/api/connected-accounts`, auth(token))
    ).json()) as ConnectedAccountsResponse;
    expect(list.accounts.some((a) => a.id === 'acct_svb')).toBe(false);
  });

  it('reconnects a reconnect_required account back to connected (AC-08)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/connected-accounts/acct_novo/reconnect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ConnectedAccountResponse;
    expect(body.account.status).toBe('connected');
  });

  it('404s removing an unknown account', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/connected-accounts/acct_missing`,
      auth(token, { method: 'DELETE' }),
    );
    expect(res.status).toBe(404);
  });
});
