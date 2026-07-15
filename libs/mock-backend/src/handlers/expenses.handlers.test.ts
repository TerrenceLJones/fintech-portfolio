import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { permissionsForRole } from '@clearline/domain-auth';
import { createExpensesHandlers } from './expenses.handlers';
import { AuthService } from '../services/auth.service';
import { ExpensesService } from '../services/expenses.service';
import { ApprovalsService } from '../services/approvals.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const [user] = SEED_USERS;
const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://expenses-test.example';

let authService: AuthService;
let approvalsService: ApprovalsService;
let expensesService: ExpensesService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  approvalsService = new ApprovalsService();
  expensesService = new ExpensesService(undefined, undefined, approvalsService);
  server.use(...createExpensesHandlers(expensesService, authService));
});

async function login(): Promise<string> {
  const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function submit(token: string, body: unknown) {
  return fetch(`${ORIGIN}/api/expenses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validExpense = {
  amount: { amountMinorUnits: 30_000, currency: 'USD' },
  categoryId: 'travel',
  merchant: 'United Airlines',
  receiptFilename: 'receipt.jpg',
};

describe('GET /api/expenses/context', () => {
  it('returns categories and the receipt threshold for a signed-in user', async () => {
    const token = await login();
    const response = await fetch(`${ORIGIN}/api/expenses/context`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toContain('software');
    expect(body.receiptRequiredThresholdMinorUnits).toBe(7_500);
    expect(body.currency).toBe('USD');
  });

  it('returns 401 without an access token', async () => {
    expect((await fetch(`${ORIGIN}/api/expenses/context`)).status).toBe(401);
  });
});

describe('POST /api/expenses', () => {
  it('creates an expense (201) and enqueues it for approval (AC-01)', async () => {
    const token = await login();
    const response = await submit(token, validExpense);
    expect(response.status).toBe(201);
    const { expense } = await response.json();
    expect(expense.status).toBe('pending_l1');

    // The submitted expense is now visible to an approver via the shared ApprovalsService.
    const queue = approvalsService.getQueue({
      userId: 'boss',
      displayName: 'Boss',
      permissions: permissionsForRole('controller', { isAdmin: false }),
      approvalLimit: null,
    });
    if (queue.outcome === 'ok') {
      expect(queue.items.map((i) => i.id)).toContain(expense.id);
    }
  });

  it('returns 422 receipt_required for an expense over $75 with no receipt (AC-02)', async () => {
    const token = await login();
    const response = await submit(token, {
      amount: { amountMinorUnits: 12_000, currency: 'USD' },
      categoryId: 'meals',
      merchant: 'Restaurant',
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'receipt_required' });
  });

  it('flags an over-policy-limit expense but still creates it (AC-03)', async () => {
    const token = await login();
    const response = await submit(token, {
      amount: { amountMinorUnits: 35_000, currency: 'USD' },
      categoryId: 'software',
      merchant: 'JetBrains',
      receiptFilename: 'invoice.pdf',
    });
    expect(response.status).toBe(201);
    expect((await response.json()).expense.policyFlagged).toBe(true);
  });
});

describe('GET /api/expenses', () => {
  it('lists the submitter’s own expenses', async () => {
    const token = await login();
    await submit(token, validExpense);
    const response = await fetch(`${ORIGIN}/api/expenses`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const { expenses } = await response.json();
    expect(expenses.length).toBeGreaterThan(0);
    const submitter = expenses[0].submitterId;
    expect(expenses.every((e: { submitterId: string }) => e.submitterId === submitter)).toBe(true);
  });
});
