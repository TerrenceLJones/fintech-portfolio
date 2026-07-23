import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  CreateApiKeyResponse,
  CreateWebhookResponse,
  DeveloperResponse,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { DeveloperService } from '../services/developer.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import { DEMO_API_KEY_PLAINTEXT, SEED_DEVELOPER } from '../fixtures/developer.fixture';
import { createDeveloperHandlers } from './developer.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';
const ORG_ID = SEED_ORGANIZATION.id;

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;
let developerService: DeveloperService;
let counter = 0;

async function tokenFor(email: string): Promise<string> {
  const login = await authService.login(email, PASSWORD, '127.0.0.1');
  return login.accessToken!;
}

async function startWith() {
  counter = 0;
  const admin = await buildSeedUser({
    id: 'user_admin',
    email: 'admin@clearline.dev',
    password: PASSWORD,
    role: 'finance_manager',
    isAdmin: true,
    orgId: ORG_ID,
  });
  const owner = await buildSeedUser({
    id: 'user_owner',
    email: 'owner@clearline.dev',
    password: PASSWORD,
    role: 'controller',
    isOwner: true,
    orgId: ORG_ID,
  });
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
  authService = new AuthService([admin, owner, controller, employee]);
  auditService = new AuditService([]);
  developerService = new DeveloperService(
    SEED_DEVELOPER,
    () => '2026-07-22T00:00:00.000Z',
    () => `token${(counter += 1).toString().padStart(4, '0')}`,
  );
  server = setupServer(...createDeveloperHandlers(developerService, authService, auditService));
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

function post(path: string, token: string, body: unknown) {
  return fetch(`${BASE}${path}`, auth(token, { method: 'POST', body: JSON.stringify(body) }));
}

beforeEach(startWith);
afterEach(() => server?.close());

describe('access control (AC-10)', () => {
  it('401s with no session', async () => {
    expect((await fetch(`${BASE}/api/developer`)).status).toBe(401);
  });

  it('403s for an Employee', async () => {
    const res = await fetch(
      `${BASE}/api/developer`,
      auth(await tokenFor('employee@clearline.dev')),
    );
    expect(res.status).toBe(403);
  });

  it('403s for a Controller who is not also Admin/Owner', async () => {
    const res = await fetch(
      `${BASE}/api/developer`,
      auth(await tokenFor('controller@clearline.dev')),
    );
    expect(res.status).toBe(403);
  });

  it('200s for an Admin and for an Owner', async () => {
    expect(
      (await fetch(`${BASE}/api/developer`, auth(await tokenFor('admin@clearline.dev')))).status,
    ).toBe(200);
    expect(
      (await fetch(`${BASE}/api/developer`, auth(await tokenFor('owner@clearline.dev')))).status,
    ).toBe(200);
  });
});

describe('API keys (AC-01/02/04)', () => {
  it('creates a key, returns the plaintext once, then only masks it', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/api-keys', token, {
      name: 'Production — Read Only',
      scopes: ['read:transactions', 'read:cards'],
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as CreateApiKeyResponse;
    expect(body.plaintextKey).toMatch(/^sk_live_/);
    expect(body.key.maskedKey).not.toBe(body.plaintextKey);

    const list = (await (
      await fetch(`${BASE}/api/developer`, auth(token))
    ).json()) as DeveloperResponse;
    expect(JSON.stringify(list)).not.toContain(body.plaintextKey);
  });

  it('rejects an empty name and an empty scope set', async () => {
    const token = await tokenFor('admin@clearline.dev');
    expect(
      (await post('/api/developer/api-keys', token, { name: ' ', scopes: ['read:cards'] })).status,
    ).toBe(422);
    expect((await post('/api/developer/api-keys', token, { name: 'X', scopes: [] })).status).toBe(
      422,
    );
  });

  it('revokes a key and drops it from the active list', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const created = (await (
      await post('/api/developer/api-keys', token, { name: 'Temp', scopes: ['read:cards'] })
    ).json()) as CreateApiKeyResponse;

    const res = await fetch(
      `${BASE}/api/developer/api-keys/${created.key.id}`,
      auth(token, { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DeveloperResponse;
    expect(body.apiKeys.some((k) => k.id === created.key.id)).toBe(false);
  });
});

describe('verify scope enforcement (AC-03/04)', () => {
  it('403s with the missing scope named for a read-only key', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/api-keys/verify', token, {
      key: DEMO_API_KEY_PLAINTEXT,
      requiredScope: 'write:transfers',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: 'insufficient_scope',
      detail: 'write:transfers',
    });
  });

  it('200s for a key that carries the scope', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/api-keys/verify', token, {
      key: DEMO_API_KEY_PLAINTEXT,
      requiredScope: 'read:transactions',
    });
    expect(res.status).toBe(200);
  });

  it('401s for a revoked or unknown key', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/api-keys/verify', token, {
      key: 'sk_live_unknown',
      requiredScope: 'read:cards',
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_key' });
  });
});

describe('webhooks (AC-06/07/09)', () => {
  it('creates an HTTPS webhook and reveals the signing secret once', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/webhooks', token, {
      url: 'https://api.acme.co/hooks',
      events: ['transfer.completed'],
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as CreateWebhookResponse;
    expect(body.signingSecret).toMatch(/^whsec_/);
    expect(body.webhook.maskedSigningSecret).not.toBe(body.signingSecret);
  });

  it('rejects a non-HTTPS URL, naming it (AC-07)', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/developer/webhooks', token, {
      url: 'http://api.acme.co/hooks',
      events: ['transfer.completed'],
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: 'invalid_url',
      detail: 'http://api.acme.co/hooks',
    });
  });

  it('resends a delivery, appending a new entry (AC-09)', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const list = (await (
      await fetch(`${BASE}/api/developer`, auth(token))
    ).json()) as DeveloperResponse;
    const webhook = list.webhooks[0]!;
    const failed = webhook.deliveries.find((d) => !d.ok)!;
    const before = webhook.deliveries.length;

    const res = await post(
      `/api/developer/webhooks/${webhook.id}/deliveries/${failed.id}/resend`,
      token,
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as DeveloperResponse;
    expect(body.webhooks[0]!.deliveries.length).toBe(before + 1);
  });
});

describe('audit (AC-10)', () => {
  it('records developer events without any plaintext key or signing secret', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const created = (await (
      await post('/api/developer/api-keys', token, { name: 'Audited', scopes: ['read:cards'] })
    ).json()) as CreateApiKeyResponse;
    const webhook = (await (
      await post('/api/developer/webhooks', token, {
        url: 'https://api.acme.co/audit',
        events: ['transfer.completed'],
      })
    ).json()) as CreateWebhookResponse;

    const events = auditService.list();
    expect(events.some((e) => e.category === 'developer')).toBe(true);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(created.plaintextKey);
    expect(serialized).not.toContain(webhook.signingSecret);
  });
});
