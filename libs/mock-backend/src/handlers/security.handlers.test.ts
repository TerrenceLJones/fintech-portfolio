import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { generateTotpCode } from '@clearline/domain-auth';
import type {
  SessionListResponse,
  StartTotpSetupResponse,
  TrustedDeviceListResponse,
  TwoFactorStatus,
  VerifyTotpSetupResponse,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { createSecurityHandlers } from './security.handlers';

const BASE = 'http://localhost';
const EMAIL = 'demo@clearline.dev';
const PASSWORD = 'correct-password';
const STRONG_NEW = 'Str0ng-Pass!word';

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let auditService: AuditService;
let accessToken: string;

async function startWith() {
  const user = await buildSeedUser({ id: 'user_1', email: EMAIL, password: PASSWORD });
  authService = new AuthService([user]);
  // Empty seed so assertions count only the events these handlers emit.
  auditService = new AuditService([]);
  server = setupServer(...createSecurityHandlers(authService, auditService));
  server.listen({ onUnhandledRequest: 'error' });
  const login = await authService.login(EMAIL, PASSWORD, '127.0.0.1');
  accessToken = login.accessToken!;
}

function auth(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
  };
}

beforeEach(startWith);
afterEach(() => server?.close());

describe('POST /api/security/password (AC-01/02/11)', () => {
  it('changes the password and records an audit event without the password', async () => {
    const res = await fetch(
      `${BASE}/api/security/password`,
      auth({
        method: 'POST',
        body: JSON.stringify({ currentPassword: PASSWORD, newPassword: STRONG_NEW }),
      }),
    );
    expect(res.status).toBe(200);
    const events = auditService.list();
    expect(events).toHaveLength(1);
    expect(events[0]!.category).toBe('account_security');
    expect(events[0]!.action).toBe('Changed password');
    expect(JSON.stringify(events)).not.toContain(STRONG_NEW);
  });

  it('422s on a wrong current password and records nothing', async () => {
    const res = await fetch(
      `${BASE}/api/security/password`,
      auth({
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'nope', newPassword: STRONG_NEW }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('incorrect_password');
    expect(auditService.list()).toHaveLength(0);
  });

  it('401s without a session', async () => {
    const res = await fetch(`${BASE}/api/security/password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: STRONG_NEW }),
    });
    expect(res.status).toBe(401);
  });
});

describe('two-factor endpoints (AC-03/04/05/07/11)', () => {
  it('runs the full setup → verify → enabled happy path and audits enablement', async () => {
    const status = (await (
      await fetch(`${BASE}/api/security/two-factor`, auth())
    ).json()) as TwoFactorStatus;
    expect(status).toEqual({ enabled: false, orgEnforced: false });

    const setup = (await (
      await fetch(`${BASE}/api/security/two-factor/setup`, auth({ method: 'POST' }))
    ).json()) as StartTotpSetupResponse;
    expect(setup.otpauthUri).toContain('otpauth://');

    const code = await generateTotpCode(setup.secret, Date.now());
    const verifyRes = await fetch(
      `${BASE}/api/security/two-factor/verify`,
      auth({ method: 'POST', body: JSON.stringify({ code }) }),
    );
    expect(verifyRes.status).toBe(200);
    const body = (await verifyRes.json()) as VerifyTotpSetupResponse;
    expect(body.backupCodes).toHaveLength(10);

    expect(auditService.list().some((e) => e.action === 'Enabled two-factor authentication')).toBe(
      true,
    );
  });

  it('422s on an incorrect verify code', async () => {
    await fetch(`${BASE}/api/security/two-factor/setup`, auth({ method: 'POST' }));
    const res = await fetch(
      `${BASE}/api/security/two-factor/verify`,
      auth({ method: 'POST', body: JSON.stringify({ code: '000000' }) }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('incorrect_code');
  });
});

describe('session endpoints (AC-08/09/11)', () => {
  it('lists sessions and revokes one other device with an audit event', async () => {
    const { sessions } = (await (
      await fetch(`${BASE}/api/security/sessions`, auth())
    ).json()) as SessionListResponse;
    const other = sessions.find((s) => !s.current)!;

    const res = await fetch(
      `${BASE}/api/security/sessions/${other.id}`,
      auth({ method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    expect(auditService.list().some((e) => e.action === 'Signed out a device')).toBe(true);
  });

  it('revokes all other devices and reports the count', async () => {
    const res = await fetch(
      `${BASE}/api/security/sessions/revoke-others`,
      auth({ method: 'POST' }),
    );
    const body = await res.json();
    expect(body.revokedCount).toBeGreaterThanOrEqual(1);
    const { sessions } = (await (
      await fetch(`${BASE}/api/security/sessions`, auth())
    ).json()) as SessionListResponse;
    expect(sessions).toHaveLength(1);
  });
});

describe('trusted-device endpoints (AC-10/11)', () => {
  it('lists and removes a trusted device with an audit event', async () => {
    const { devices } = (await (
      await fetch(`${BASE}/api/security/trusted-devices`, auth())
    ).json()) as TrustedDeviceListResponse;
    expect(devices.length).toBeGreaterThanOrEqual(1);

    const res = await fetch(
      `${BASE}/api/security/trusted-devices/${devices[0]!.id}`,
      auth({ method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    expect(auditService.list().some((e) => e.action === 'Removed a trusted device')).toBe(true);
  });
});
