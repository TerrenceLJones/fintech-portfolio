import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type { OrgSecurityResponse, TestSsoResponse } from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { SEED_ORGANIZATION } from '../fixtures/users.fixture';
import {
  DEMO_CURRENT_IP,
  DEMO_SSO_CERTIFICATE,
  DEMO_SSO_ENTITY_ID,
  DEMO_SSO_METADATA_URL,
} from '../fixtures/org-security.fixture';
import { createOrgSecurityHandlers } from './org-security.handlers';

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
  const admin = await buildSeedUser({
    id: 'user_admin',
    email: 'admin@clearline.dev',
    password: PASSWORD,
    role: 'finance_manager',
    isAdmin: true,
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
  authService = new AuthService([admin, controller, employee]);
  auditService = new AuditService([]);
  server = setupServer(...createOrgSecurityHandlers(authService, auditService));
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

describe('GET /api/org-security (AC-09)', () => {
  it('403s for an Employee', async () => {
    const res = await fetch(
      `${BASE}/api/org-security`,
      auth(await tokenFor('employee@clearline.dev')),
    );
    expect(res.status).toBe(403);
  });

  it('403s for a Controller who is not also Admin/Owner', async () => {
    const res = await fetch(
      `${BASE}/api/org-security`,
      auth(await tokenFor('controller@clearline.dev')),
    );
    expect(res.status).toBe(403);
  });

  it('returns the coalesced defaults for an Admin', async () => {
    const res = await fetch(
      `${BASE}/api/org-security`,
      auth(await tokenFor('admin@clearline.dev')),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as OrgSecurityResponse;
    expect(body.requireTwoFactor).toBe(false);
    expect(body.idleTimeoutMinutes).toBe(15);
    expect(body.ipAllowlist).toEqual([]);
    expect(body.sso.enabled).toBe(false);
    expect(body.currentIp).toBe(DEMO_CURRENT_IP);
  });
});

describe('SSO connection test + enable (AC-01/02)', () => {
  it('passes for a well-formed config, stores only a fingerprint, and never echoes the certificate', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/org-security/sso/test', token, {
      metadataUrl: DEMO_SSO_METADATA_URL,
      entityId: DEMO_SSO_ENTITY_ID,
      certificate: DEMO_SSO_CERTIFICATE,
    });
    const body = (await res.json()) as TestSsoResponse;
    expect(body.result).toBe('passed');
    expect(body.sso.certificateFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(body)).not.toContain('BEGIN CERTIFICATE');
  });

  it('fails with a specific reason for an unreachable metadata URL', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/org-security/sso/test', token, {
      metadataUrl: 'http://idp.example.com/metadata',
      entityId: DEMO_SSO_ENTITY_ID,
      certificate: DEMO_SSO_CERTIFICATE,
    });
    const body = (await res.json()) as TestSsoResponse;
    expect(body).toMatchObject({ result: 'failed', reason: 'Metadata URL unreachable' });
  });

  it('refuses to enable SSO until a test has passed, then allows it', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const blocked = await post('/api/org-security/sso/enabled', token, { enabled: true });
    expect(blocked.status).toBe(422);
    expect(await blocked.json()).toMatchObject({ error: 'sso_test_required' });

    await post('/api/org-security/sso/test', token, {
      metadataUrl: DEMO_SSO_METADATA_URL,
      entityId: DEMO_SSO_ENTITY_ID,
      certificate: DEMO_SSO_CERTIFICATE,
    });
    const ok = await post('/api/org-security/sso/enabled', token, { enabled: true });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as OrgSecurityResponse).sso.enabled).toBe(true);
  });
});

describe('idle timeout (AC-05)', () => {
  it('rejects an off-ladder value and accepts a valid one', async () => {
    const token = await tokenFor('admin@clearline.dev');
    expect(
      (await post('/api/org-security/idle-timeout', token, { idleTimeoutMinutes: 45 })).status,
    ).toBe(422);
    const ok = await post('/api/org-security/idle-timeout', token, { idleTimeoutMinutes: 60 });
    expect(((await ok.json()) as OrgSecurityResponse).idleTimeoutMinutes).toBe(60);
  });
});

describe('IP allowlist self-lockout guard (AC-06/07/08)', () => {
  it('rejects a malformed CIDR', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/org-security/ip-allowlist', token, { cidr: 'not-a-range' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'invalid_cidr' });
  });

  it('blocks a save that would exclude the acting admin, naming the IP (AC-07)', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const res = await post('/api/org-security/ip-allowlist', token, { cidr: '198.51.100.0/24' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'self_lockout', detail: DEMO_CURRENT_IP });
  });

  it('adds a range that covers the admin, then removes it (AC-06/08)', async () => {
    const token = await tokenFor('admin@clearline.dev');
    const added = await post('/api/org-security/ip-allowlist', token, { cidr: '203.0.113.0/24' });
    expect(((await added.json()) as OrgSecurityResponse).ipAllowlist).toEqual(['203.0.113.0/24']);

    const removed = await fetch(
      `${BASE}/api/org-security/ip-allowlist`,
      auth(token, { method: 'DELETE', body: JSON.stringify({ cidr: '203.0.113.0/24' }) }),
    );
    expect(((await removed.json()) as OrgSecurityResponse).ipAllowlist).toEqual([]);
  });
});

describe('audit (AC-10)', () => {
  it('records org_security events without the certificate material', async () => {
    const token = await tokenFor('admin@clearline.dev');
    await post('/api/org-security/two-factor', token, { requireTwoFactor: true });
    const events = auditService.list();
    expect(events.some((e) => e.category === 'org_security')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('BEGIN CERTIFICATE');
  });
});

describe('org-enforced 2FA login gate (AC-04, next-login semantics)', () => {
  it('does not force a member already mid-session, but gates their next login', async () => {
    // A session minted before enforcement is never gated mid-session.
    const before = await authService.login('employee@clearline.dev', PASSWORD, '127.0.0.1');
    const beforeCheck = authService.checkSession(before.accessToken!);
    expect(beforeCheck.twoFactorSetupRequired).toBe(false);

    authService.setTwoFactorEnforcement(ORG_ID, true);
    // The pre-existing session stays ungated (not forced mid-session).
    expect(authService.checkSession(before.accessToken!).twoFactorSetupRequired).toBe(false);

    // A fresh login while enforced + unenrolled is gated.
    const after = await authService.login('employee@clearline.dev', PASSWORD, '127.0.0.1');
    expect(authService.checkSession(after.accessToken!).twoFactorSetupRequired).toBe(true);
  });

  it('surfaces the org idle-timeout on the session (AC-05)', async () => {
    authService.setIdleTimeout(ORG_ID, 60);
    const login = await authService.login('employee@clearline.dev', PASSWORD, '127.0.0.1');
    expect(authService.checkSession(login.accessToken!).idleTimeoutMinutes).toBe(60);
  });
});
