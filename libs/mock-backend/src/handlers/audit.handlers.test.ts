import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { AuditLogResponse } from '@clearline/contracts';
import { createAuditHandlers } from './audit.handlers';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://audit-test.example';

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
  auditService = new AuditService();
  server.use(...createAuditHandlers(auditService, authService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function getLog(token?: string) {
  return fetch(`${ORIGIN}/api/audit-log`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/audit-log', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const response = await getLog();
    expect(response.status).toBe(401);
  });

  it('denies a non-Controller (Employee) with 403 forbidden_role — never a limited view', async () => {
    const token = await loginAs('employee@clearline.dev');
    const response = await getLog(token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden_role' });
  });

  it('denies a Finance Manager (no audit:view) with 403', async () => {
    const token = await loginAs('demo@clearline.dev');
    const response = await getLog(token);
    expect(response.status).toBe(403);
  });

  it('returns the append-only log to a Controller, newest-first', async () => {
    const token = await loginAs('controller@clearline.dev');
    const response = await getLog(token);
    expect(response.status).toBe(200);
    const body = (await response.json()) as AuditLogResponse;
    expect(body.events.length).toBeGreaterThan(0);
    const timestamps = body.events.map((e) => e.timestamp);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  it('records the access itself as a new audit event at the top of the log (AC-06)', async () => {
    const token = await loginAs('controller@clearline.dev');
    const before = auditService.list().length;

    const response = await getLog(token);
    const body = (await response.json()) as AuditLogResponse;

    // The store grew by exactly the one self-referential view event…
    expect(auditService.list()).toHaveLength(before + 1);
    // …and it is the newest event the caller sees, attributed to them.
    const top = body.events[0]!;
    expect(top.category).toBe('audit_access');
    expect(top.action).toBe('Viewed audit log');
    expect(top.actor.name).toBe('Sofia Whitman');
    expect(top.actor.role).toBe('controller');
  });

  it('does not record an access event when the caller is denied', async () => {
    const token = await loginAs('employee@clearline.dev');
    const before = auditService.list().length;
    await getLog(token);
    expect(auditService.list()).toHaveLength(before);
  });
});
