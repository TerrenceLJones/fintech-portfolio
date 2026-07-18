import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createPaymentsHandlers } from './payments.handlers';
import { createApprovalsHandlers } from './approvals.handlers';
import { createCardsHandlers } from './cards.handlers';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { PaymentsService } from '../services/payments.service';
import { ApprovalsService } from '../services/approvals.service';
import { CardsService } from '../services/cards.service';
import { DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://audit-emission-test.example';

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
  // Empty seed so only events emitted during the test are present — clean assertions.
  auditService = new AuditService([]);
  server.use(
    ...createPaymentsHandlers(new PaymentsService(), authService, auditService),
    ...createApprovalsHandlers(new ApprovalsService(), authService, auditService),
    ...createCardsHandlers(new CardsService(), authService, auditService),
  );
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

describe('payment submission emits an audit event (AC-01)', () => {
  it('records a successful submission with actor, amount, recipient, idempotency key, and outcome', async () => {
    const token = await loginAs('demo@clearline.dev');
    await fetch(`${ORIGIN}/api/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'idem-pay-1',
      },
      body: JSON.stringify({
        recipientId: 'rec_acme',
        amount: { amountMinorUnits: 500_000, currency: 'USD' },
      }),
    });

    const [event] = auditService.list();
    expect(event!.category).toBe('payment');
    expect(event!.action).toBe('Submitted payment');
    expect(event!.actor.role).toBe('finance_manager');
    expect(event!.meta?.idempotencyKey).toBe('idem-pay-1');
    expect(event!.meta?.amount).toEqual({ amountMinorUnits: 500_000, currency: 'USD' });
    expect(event!.meta?.outcome).toBe('submitted');
  });

  it('records a rejected submission too — regardless of outcome (AC-01 edge case)', async () => {
    const token = await loginAs('demo@clearline.dev');
    await fetch(`${ORIGIN}/api/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'idem-pay-2',
      },
      // Zero amount trips validation — a rejected submission that must still be logged.
      body: JSON.stringify({
        recipientId: 'rec_acme',
        amount: { amountMinorUnits: 0, currency: 'USD' },
      }),
    });

    const [event] = auditService.list();
    expect(event!.category).toBe('payment');
    expect(event!.meta?.outcome).toContain('rejected');
  });
});

describe('approval decision emits an audit event (AC-02)', () => {
  it('records who approved, what action, and on which expense', async () => {
    const token = await loginAs('demo@clearline.dev');
    await fetch(`${ORIGIN}/api/approvals/exp_4201/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    const [event] = auditService.list();
    expect(event!.category).toBe('approval');
    expect(event!.action).toBe('Approved expense');
    expect(event!.target?.ref).toBe('exp_4201');
    expect(event!.actor.role).toBe('finance_manager');
  });
});

describe('card control change emits an audit event with before → after (AC-03)', () => {
  it('records a freeze with an Active → Frozen diff', async () => {
    const token = await loginAs('controller@clearline.dev');
    await fetch(`${ORIGIN}/api/cards/card_4021/freeze`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ frozen: true }),
    });

    const [event] = auditService.list();
    expect(event!.category).toBe('card_control');
    expect(event!.action).toBe('Froze card');
    expect(event!.diff).toEqual({ from: 'Active', to: 'Frozen', tone: 'neutral' });
  });

  it('records card issuance with its limit', async () => {
    const token = await loginAs('controller@clearline.dev');
    await fetch(`${ORIGIN}/api/cards`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        holderId: 'emp_reyes',
        monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
        allowedMccs: ['software', 'office_supplies'],
      }),
    });

    const [event] = auditService.list();
    expect(event!.category).toBe('card_control');
    expect(event!.action).toBe('Issued card');
    expect(event!.detail).toContain('$2,000.00');
  });
});
