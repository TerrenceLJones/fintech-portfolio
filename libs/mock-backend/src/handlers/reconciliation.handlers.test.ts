import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  createReconciliationHandlers,
  setReconciliationSectionFailure,
} from './reconciliation.handlers';
import { AuthService } from '../services/auth.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const financeManager = SEED_USERS.find((u) => u.role === 'finance_manager')!;
const employee = SEED_USERS.find((u) => u.role === 'employee')!;
const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://reconciliation-test.example';

let authService: AuthService;
let reconciliationService: ReconciliationService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  setReconciliationSectionFailure('exceptions', false);
  setReconciliationSectionFailure('summary', false);
});
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  reconciliationService = new ReconciliationService();
  server.use(...createReconciliationHandlers(reconciliationService, authService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function get(path: string, token?: string) {
  return fetch(`${ORIGIN}/api/reconciliation/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function post(path: string, token: string, body?: unknown) {
  return fetch(`${ORIGIN}/api/reconciliation/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('reconciliation endpoints — auth', () => {
  it('returns 401 without an access token', async () => {
    expect((await get('summary')).status).toBe(401);
  });

  it('returns 403 for an Employee (no reconciliation:view)', async () => {
    const token = await loginAs(employee.email);
    const response = await get('exceptions', token);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('forbidden_role');
  });

  it('serves the queue and summary for a Finance Manager (has reconciliation:view)', async () => {
    const token = await loginAs(financeManager.email);
    expect((await (await get('summary', token)).json()).summary.autoMatchedCount).toBeGreaterThan(
      0,
    );
    expect((await (await get('exceptions', token)).json()).exceptions.length).toBeGreaterThan(0);
    expect(Array.isArray((await (await get('matched', token)).json()).matched)).toBe(true);
    expect((await (await get('balance', token)).json()).balance.status).toBe('ok');
  });
});

describe('reconciliation endpoints — section failure', () => {
  it('fails only the armed panel, leaving the others healthy', async () => {
    const token = await loginAs(financeManager.email);
    setReconciliationSectionFailure('exceptions', true);
    expect((await get('exceptions', token)).status).toBe(500);
    expect((await get('summary', token)).status).toBe(200);
    expect((await get('balance', token)).status).toBe(200);
  });
});

describe('reconciliation endpoints — queue actions', () => {
  it('confirms a suggested match and removes it from the queue (AC-03)', async () => {
    const token = await loginAs(financeManager.email);
    const response = await post('exceptions/exc_bank_abc/confirm', token);
    expect(response.status).toBe(200);
    const remaining = (await (await get('exceptions', token)).json()).exceptions;
    expect(remaining.some((e: { id: string }) => e.id === 'exc_bank_abc')).toBe(false);
  });

  it('returns 404 confirming an unknown exception', async () => {
    const token = await loginAs(financeManager.email);
    expect((await post('exceptions/exc_missing/confirm', token)).status).toBe(404);
  });

  it('rejects a split that does not sum with 422 and the expected/provided totals (AC-05)', async () => {
    const token = await loginAs(financeManager.email);
    const response = await post('exceptions/exc_bank_acme/split', token, {
      portions: [
        {
          ledgerEntryId: 'led_inv_20418',
          label: 'INV-20418',
          amount: { amountMinorUnits: 300_000, currency: 'USD' },
        },
        {
          ledgerEntryId: 'led_inv_20419',
          label: 'INV-20419',
          amount: { amountMinorUnits: 100_000, currency: 'USD' },
        },
      ],
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe('split_mismatch');
    expect(body.expected.amountMinorUnits).toBe(500_000);
    expect(body.provided.amountMinorUnits).toBe(400_000);
  });

  it('commits a balanced split (AC-05)', async () => {
    const token = await loginAs(financeManager.email);
    const response = await post('exceptions/exc_bank_acme/split', token, {
      portions: [
        {
          ledgerEntryId: 'led_inv_20418',
          label: 'INV-20418',
          amount: { amountMinorUnits: 300_000, currency: 'USD' },
        },
        {
          ledgerEntryId: 'led_inv_20419',
          label: 'INV-20419',
          amount: { amountMinorUnits: 200_000, currency: 'USD' },
        },
      ],
    });
    expect(response.status).toBe(200);
    expect((await response.json()).matched.method).toBe('split');
  });
});
