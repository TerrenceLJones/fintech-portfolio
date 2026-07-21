import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  CardProgramDefaultsResponse,
  UpdateCardProgramDefaultsRequest,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { createCardProgramHandlers } from './card-program.handlers';

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
  server = setupServer(...createCardProgramHandlers(authService, auditService));
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

describe('GET /api/card-program', () => {
  it('403s for an Employee without card-program:manage (AC-09)', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(`${BASE}/api/card-program`, auth(token));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden_role' });
  });

  it('returns the default limits, policy, and searchable catalogue for a Controller (AC-01/02)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/card-program`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as CardProgramDefaultsResponse;
    expect(body.defaultMonthlyLimit.amountMinorUnits).toBe(200_000);
    expect(body.defaultPerTransactionLimit.amountMinorUnits).toBe(50_000);
    expect(body.issuancePolicy).toBe('everyone');
    expect(body.merchantCategories.length).toBeGreaterThan(0);
    expect(body.merchantCategories.every((c) => c.mcc && c.label)).toBe(true);
  });
});

describe('PATCH /api/card-program', () => {
  const patch: UpdateCardProgramDefaultsRequest = {
    defaultMonthlyLimitMinorUnits: 300_000,
    defaultPerTransactionLimitMinorUnits: 75_000,
    defaultAllowedMccs: ['software', 'travel'],
    issuancePolicy: 'managers_and_above',
  };

  it('saves valid defaults and records a card_program audit event (AC-01/02/03/10)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/card-program`,
      auth(token, { method: 'PATCH', body: JSON.stringify(patch) }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as CardProgramDefaultsResponse;
    expect(body.defaultMonthlyLimit.amountMinorUnits).toBe(300_000);
    expect(body.issuancePolicy).toBe('managers_and_above');

    const events = auditService.list();
    expect(events).toHaveLength(1);
    expect(events[0]!.category).toBe('card_program');
    expect(events[0]!.diff?.to).toContain('Finance Managers');
  });

  it('rejects a per-transaction limit above the monthly limit and saves nothing (AC-01)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/card-program`,
      auth(token, {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, defaultPerTransactionLimitMinorUnits: 9_000_000 }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_limit');
    expect(auditService.list()).toHaveLength(0);
  });

  it('rejects an unknown MCC code (AC-02)', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/card-program`,
      auth(token, {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, defaultAllowedMccs: ['not_a_real_mcc'] }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('403s for an Employee and records nothing (AC-09)', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(
      `${BASE}/api/card-program`,
      auth(token, { method: 'PATCH', body: JSON.stringify(patch) }),
    );
    expect(res.status).toBe(403);
    expect(auditService.list()).toHaveLength(0);
  });
});
