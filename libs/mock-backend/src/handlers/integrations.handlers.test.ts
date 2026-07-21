import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  GlMappingResponse,
  IntegrationResponse,
  IntegrationsResponse,
  SyncLogResponse,
  SyncResult,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { IntegrationsService } from '../services/integrations.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { createIntegrationsHandlers } from './integrations.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';
const ORG_ID = SEED_ORGANIZATION.id;

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;
let service: IntegrationsService;

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
  service = new IntegrationsService();
  server = setupServer(...createIntegrationsHandlers(service, authService, auditService));
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

describe('GET /api/integrations (AC-09)', () => {
  it('403s for an Employee without integrations:manage', async () => {
    const token = await tokenFor('employee@clearline.dev');
    const res = await fetch(`${BASE}/api/integrations`, auth(token));
    expect(res.status).toBe(403);
  });

  it('lists all providers for a Controller', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/integrations`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as IntegrationsResponse;
    expect(body.integrations.map((i) => i.provider)).toEqual(['quickbooks', 'xero', 'netsuite']);
  });
});

describe('connect (AC-01)', () => {
  it('connects a disconnected provider and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/xero/connect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as IntegrationResponse;
    expect(body.integration.status).toBe('connected');
    expect(auditService.list()[0]!.category).toBe('accounting_integration');
  });

  it('409s connecting an already-connected provider', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/quickbooks/connect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(409);
  });

  it('404s an unknown provider', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/sage/connect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(404);
  });
});

describe('GL mapping (AC-02)', () => {
  it('returns the mapping with the provider chart of accounts', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/integrations/quickbooks/gl-mapping`, auth(token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GlMappingResponse;
    expect(body.chartOfAccounts.length).toBeGreaterThan(0);
    expect(body.mappings.some((m) => !m.glAccountId)).toBe(true);
  });

  it('updates a mapping and records a before → after diff', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/quickbooks/gl-mapping`,
      auth(token, {
        method: 'PUT',
        body: JSON.stringify({ mappings: [{ categoryId: 'equipment', glAccountId: 'coa_6300' }] }),
      }),
    );
    expect(res.status).toBe(200);
    const event = auditService.list()[0]!;
    expect(event.category).toBe('accounting_integration');
    expect(event.diff).toBeDefined();
  });
});

describe('sync now + log (AC-03/05)', () => {
  it('syncs and reports the record count and outcome', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/quickbooks/sync`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SyncResult;
    expect(body.outcome).toBe('partial'); // one seeded category unmapped
    expect(body.recordsSynced).toBeGreaterThan(0);
  });

  it('returns the sync log', async () => {
    const token = await tokenFor('controller@clearline.dev');
    await fetch(`${BASE}/api/integrations/quickbooks/sync`, auth(token, { method: 'POST' }));
    const res = await fetch(`${BASE}/api/integrations/quickbooks/sync-log`, auth(token));
    const body = (await res.json()) as SyncLogResponse;
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('409s syncing a disconnected provider', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(`${BASE}/api/integrations/xero/sync`, auth(token, { method: 'POST' }));
    expect(res.status).toBe(409);
  });
});

describe('reconnect + disconnect (AC-04/06)', () => {
  it('reconnects a provider in error state', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/netsuite/reconnect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as IntegrationResponse).integration.status).toBe('connected');
  });

  it('disconnects a connected provider and audits it', async () => {
    const token = await tokenFor('controller@clearline.dev');
    const res = await fetch(
      `${BASE}/api/integrations/quickbooks/disconnect`,
      auth(token, { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as IntegrationResponse).integration.status).toBe('disconnected');
    expect(auditService.list()[0]!.action).toContain('Disconnected');
  });
});
