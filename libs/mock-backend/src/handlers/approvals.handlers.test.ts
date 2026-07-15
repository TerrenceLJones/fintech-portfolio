import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createApprovalsHandlers } from './approvals.handlers';
import { AuthService } from '../services/auth.service';
import { ApprovalsService } from '../services/approvals.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const [user] = SEED_USERS;
const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://approvals-test.example';

let authService: AuthService;
let approvalsService: ApprovalsService;
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
  server.use(...createApprovalsHandlers(approvalsService, authService));
});

async function login(): Promise<string> {
  const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function getQueue(token?: string) {
  return fetch(`${ORIGIN}/api/approvals`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function approve(id: string, token: string, idempotencyKey?: string) {
  return fetch(`${ORIGIN}/api/approvals/${id}/approve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
  });
}

function escalate(id: string, token: string) {
  return fetch(`${ORIGIN}/api/approvals/${id}/escalate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

function reject(id: string, token: string, reason = 'Out of policy') {
  return fetch(`${ORIGIN}/api/approvals/${id}/reject`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

describe('GET /api/approvals', () => {
  it('returns the queue for a Finance Manager', async () => {
    const token = await login();
    const response = await getQueue(token);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((i: { id: string }) => i.id)).toContain('exp_4201');
  });

  it('returns 401 without an access token', async () => {
    expect((await getQueue()).status).toBe(401);
  });

  it('returns 401 access_token_expired for an expired token so silent refresh can recover (US-CW-002 AC-01)', async () => {
    const token = await login();
    authService.expireAccessTokensForE2E(user!.email);

    const response = await getQueue(token);
    expect(response.status).toBe(401);
    // The recoverable code — NOT a generic invalid_token — so the client's silent-refresh interceptor
    // engages on the queue endpoint exactly as it does on /api/auth/session.
    expect(await response.json()).toEqual({ error: 'access_token_expired' });
  });

  it('returns 403 forbidden_role for an Employee (server-enforced regardless of UI) — AC-04', async () => {
    const token = await login();
    authService.setUserRole(user!.email, { role: 'employee', approvalLimit: null });

    const response = await getQueue(token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden_role' });
  });
});

describe('POST /api/approvals/:id/approve', () => {
  it('approves an in-limit expense submitted by someone else', async () => {
    const token = await login();
    const response = await approve('exp_4201', token);
    expect(response.status).toBe(200);
    expect((await response.json()).item.id).toBe('exp_4201');
  });

  it('rejects an over-limit approval with 403 and the caller’s limit — AC-06', async () => {
    const token = await login();
    const response = await approve('exp_4471', token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'approval_limit_exceeded',
      approvalLimit: 1_000_000,
    });
  });

  it('rejects self-approval with 403 even via a direct call — AC-07', async () => {
    const token = await login();
    const response = await approve('exp_4460', token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'self_approval_blocked' });
  });

  it('rejects an Employee with 403 forbidden_role', async () => {
    const token = await login();
    authService.setUserRole(user!.email, { role: 'employee', approvalLimit: null });
    const response = await approve('exp_4201', token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden_role' });
  });

  it('returns 404 for an unknown expense', async () => {
    const token = await login();
    expect((await approve('nope', token)).status).toBe(404);
  });
});

describe('POST /api/approvals/:id/reject', () => {
  it('rejects an expense and drops it from the queue', async () => {
    const token = await login();
    expect((await reject('exp_4201', token)).status).toBe(200);
    const queue = await (await getQueue(token)).json();
    expect(queue.items.map((i: { id: string }) => i.id)).not.toContain('exp_4201');
  });
});

describe('per-item idempotency key (US-CW-013 AC-02)', () => {
  it('replays the original 200 for a repeated Idempotency-Key rather than a 409', async () => {
    const token = await login();
    const first = await approve('exp_4201', token, 'idem-abc');
    expect(first.status).toBe(200);

    // A resumed batch re-sends the same key for that item — the server must not 409 or double-apply.
    const replay = await approve('exp_4201', token, 'idem-abc');
    expect(replay.status).toBe(200);
    expect((await replay.json()).item.id).toBe('exp_4201');
  });
});

describe('stale action returns 409 with the approver who already actioned it — AC-05', () => {
  it('returns 409 stale_action when approving an already-approved item', async () => {
    const token = await login();
    expect((await approve('exp_4201', token)).status).toBe(200);

    const response = await approve('exp_4201', token);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'stale_action',
      actedBy: user!.displayName,
    });
  });
});

describe('POST /api/approvals/:id/escalate', () => {
  it('routes an over-limit expense to a Controller (L2)', async () => {
    const token = await login();
    const response = await escalate('exp_4471', token);
    expect(response.status).toBe(200);
    const { item } = await response.json();
    expect(item.status).toBe('pending_l2');
    expect(item.escalatedBy).toBe(user!.displayName);
  });
});
