import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  ApprovalPolicyResponse,
  SpendControlsResponse,
  UpdateApprovalPolicyRequest,
  UpdateSpendControlsRequest,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { createPoliciesHandlers } from './policies.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';
const ORG_ID = SEED_ORGANIZATION.id;

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;

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
  server = setupServer(...createPoliciesHandlers(authService, auditService));
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

describe('GET /api/approval-policy', () => {
  it('403s for an Employee without policies:manage (AC-09)', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(`${BASE}/api/approval-policy`, auth(token));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden_role' });
  });

  it('returns the default tier ladder for a Controller (AC-01)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/approval-policy`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApprovalPolicyResponse;
    expect(body.currency).toBe('USD');
    expect(body.tiers[0]!.minMinorUnits).toBe(0);
    expect(body.tiers.at(-1)!.maxMinorUnits).toBeNull();
  });
});

describe('PATCH /api/approval-policy', () => {
  const coherent: UpdateApprovalPolicyRequest = {
    tiers: [
      { minMinorUnits: 0, maxMinorUnits: 99_999, approver: 'auto' },
      { minMinorUnits: 100_000, maxMinorUnits: 5_000_000, approver: 'finance_manager' },
      { minMinorUnits: 5_000_001, maxMinorUnits: null, approver: 'controller' },
    ],
  };

  it('saves a coherent ladder and records an approval_policy audit event (AC-02/AC-10)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/approval-policy`,
      auth(token, { method: 'PATCH', body: JSON.stringify(coherent) }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApprovalPolicyResponse;
    expect(body.tiers).toHaveLength(3);
    expect(body.tiers[0]!.approver).toBe('auto');
    expect(body.tiers[0]!.id).toBeTruthy();

    const events = auditService.list();
    expect(events).toHaveLength(1);
    expect(events[0]!.category).toBe('approval_policy');
    expect(events[0]!.diff?.to).toContain('Auto-approve');
  });

  it('rejects an overlapping ladder with the specific message and saves nothing (AC-03)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const overlapping: UpdateApprovalPolicyRequest = {
      tiers: [
        { minMinorUnits: 0, maxMinorUnits: 1_000_000, approver: 'finance_manager' },
        { minMinorUnits: 500_000, maxMinorUnits: null, approver: 'controller' },
      ],
    };
    const res = await fetch(
      `${BASE}/api/approval-policy`,
      auth(token, { method: 'PATCH', body: JSON.stringify(overlapping) }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('incoherent_policy');
    expect(body.issues[0]).toContain('overlaps');
    expect(auditService.list()).toHaveLength(0);
  });
});

describe('GET /api/spend-controls', () => {
  it('returns the default controls joined with the category catalogue (AC-06/AC-08)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/spend-controls`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SpendControlsResponse;
    expect(body.receiptRequiredThresholdMinorUnits).toBe(7_500);
    expect(body.outOfPolicyBehavior).toBe('flag');
    expect(body.categoryCaps.every((cap) => cap.monthlyLimitMinorUnits === null)).toBe(true);
    expect(body.categoryCaps.length).toBeGreaterThan(0);
  });
});

describe('PATCH /api/spend-controls', () => {
  it('persists thresholds, a category cap, and records a spend_control audit event (AC-06/07/08/10)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const patch: UpdateSpendControlsRequest = {
      receiptRequiredThresholdMinorUnits: 7_500,
      memoRequiredThresholdMinorUnits: 20_000,
      outOfPolicyBehavior: 'block',
      categoryCaps: [{ categoryId: 'meals', monthlyLimitMinorUnits: 30_000 }],
    };
    const res = await fetch(
      `${BASE}/api/spend-controls`,
      auth(token, { method: 'PATCH', body: JSON.stringify(patch) }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SpendControlsResponse;
    expect(body.memoRequiredThresholdMinorUnits).toBe(20_000);
    expect(body.outOfPolicyBehavior).toBe('block');
    expect(
      body.categoryCaps.find((cap) => cap.categoryId === 'meals')!.monthlyLimitMinorUnits,
    ).toBe(30_000);

    const events = auditService.list();
    expect(events).toHaveLength(1);
    expect(events[0]!.category).toBe('spend_control');
  });

  it('403s for an Employee and records nothing (AC-09)', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(
      `${BASE}/api/spend-controls`,
      auth(token, {
        method: 'PATCH',
        body: JSON.stringify({
          receiptRequiredThresholdMinorUnits: 0,
          memoRequiredThresholdMinorUnits: 0,
          outOfPolicyBehavior: 'flag',
          categoryCaps: [],
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(auditService.list()).toHaveLength(0);
  });
});
