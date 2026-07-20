import { beforeEach, describe, expect, it } from 'vitest';
import { generateTotpCode, verifyPassword } from '@clearline/domain-auth';
import { AuthService } from './auth.service';
import { buildSeedUser } from '../fixtures/test-factories';

const EMAIL = 'demo@clearline.dev';
const PASSWORD = 'correct-password';
// A password that clears the strict sign-up bar (>= 12 chars, mixed case, number, symbol).
const STRONG_NEW = 'Str0ng-Pass!word';
const NOW = 1_700_000_000_000;

async function makeService(overrides: Parameters<typeof buildSeedUser>[0] = {}) {
  const user = await buildSeedUser({
    id: 'user_1',
    email: EMAIL,
    password: PASSWORD,
    ...overrides,
  });
  return { service: new AuthService([user]), user };
}

describe('changePassword (AC-01/02)', () => {
  it('updates the password when the current one is correct and the new one is strong', async () => {
    const { service } = await makeService();
    const result = await service.changePassword(EMAIL, PASSWORD, STRONG_NEW);
    expect(result.outcome).toBe('success');

    // The new password now logs in; the old one no longer does.
    const relogin = await service.login(EMAIL, STRONG_NEW, '127.0.0.1');
    expect(relogin.outcome).toBe('success');
    const oldLogin = await service.login(EMAIL, PASSWORD, '127.0.0.1');
    expect(oldLogin.outcome).not.toBe('success');
  });

  it('rejects a wrong current password without changing anything', async () => {
    const { service } = await makeService();
    const result = await service.changePassword(EMAIL, 'wrong-password', STRONG_NEW);
    expect(result.outcome).toBe('incorrect_password');
    const login = await service.login(EMAIL, PASSWORD, '127.0.0.1');
    expect(login.outcome).toBe('success');
  });

  it('rejects a new password below the strength bar', async () => {
    const { service } = await makeService();
    const result = await service.changePassword(EMAIL, PASSWORD, 'weak');
    expect(result.outcome).toBe('weak_password');
  });

  it('does NOT revoke other active sessions (contrast with password reset)', async () => {
    const { service } = await makeService();
    const sessionA = await service.login(EMAIL, PASSWORD, '127.0.0.1');
    const sessionB = await service.login(EMAIL, PASSWORD, '127.0.0.2');

    await service.changePassword(EMAIL, PASSWORD, STRONG_NEW);

    expect(service.checkSession(sessionA.accessToken!).outcome).toBe('active');
    expect(service.checkSession(sessionB.accessToken!).outcome).toBe('active');
  });
});

describe('two-factor setup (AC-03/04/05/06/07)', () => {
  let service: AuthService;
  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('starts disabled with no org enforcement', () => {
    expect(service.getTwoFactorStatus(EMAIL)).toEqual({ enabled: false, orgEnforced: false });
  });

  it('generates a client-renderable secret + otpauth URI without enabling 2FA (AC-03/05)', () => {
    const setup = service.startTotpSetup(EMAIL)!;
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.otpauthUri).toContain(`secret=${setup.secret}`);
    expect(service.getTwoFactorStatus(EMAIL)!.enabled).toBe(false);
  });

  it('rejects an incorrect code and leaves 2FA unverified (AC-05)', async () => {
    service.startTotpSetup(EMAIL);
    const result = await service.verifyTotpSetup(EMAIL, '000000', NOW);
    expect(result.outcome).toBe('incorrect_code');
    expect(service.getTwoFactorStatus(EMAIL)!.enabled).toBe(false);
  });

  it('enables 2FA and returns ten one-time backup codes on a correct code (AC-04)', async () => {
    const setup = service.startTotpSetup(EMAIL)!;
    const code = await generateTotpCode(setup.secret, NOW);
    const result = await service.verifyTotpSetup(EMAIL, code, NOW);
    expect(result.outcome).toBe('success');
    if (result.outcome !== 'success') return;
    expect(result.backupCodes).toHaveLength(10);
    for (const c of result.backupCodes) expect(c).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    expect(service.getTwoFactorStatus(EMAIL)!.enabled).toBe(true);
  });

  it('reports no_pending_setup when verifying without an in-progress setup', async () => {
    const result = await service.verifyTotpSetup(EMAIL, '000000', NOW);
    expect(result.outcome).toBe('no_pending_setup');
  });

  it('disables 2FA when the org does not enforce it (AC-07)', async () => {
    const setup = service.startTotpSetup(EMAIL)!;
    await service.verifyTotpSetup(EMAIL, await generateTotpCode(setup.secret, NOW), NOW);
    expect(service.disableTwoFactor(EMAIL).outcome).toBe('success');
    expect(service.getTwoFactorStatus(EMAIL)!.enabled).toBe(false);
  });
});

describe('two-factor with org enforcement (AC-07)', () => {
  async function makeEnforcedService() {
    const user = await buildSeedUser({
      id: 'user_1',
      email: EMAIL,
      password: PASSWORD,
      orgId: 'org_enforced',
    });
    const service = new AuthService(
      [user],
      [
        {
          id: 'org_enforced',
          legalName: 'Locked Co',
          ein: '99-9999999',
          createdAt: 0,
          enforceTwoFactor: true,
        },
      ],
    );
    return service;
  }

  it('reports orgEnforced and refuses to disable', async () => {
    const service = await makeEnforcedService();
    expect(service.getTwoFactorStatus(EMAIL)!.orgEnforced).toBe(true);
    expect(service.disableTwoFactor(EMAIL).outcome).toBe('org_enforced');
  });
});

describe('active sessions (AC-08/09)', () => {
  // The demo email is seeded with three sessions (current + two others) — design §19.4.
  let service: AuthService;
  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('lists sessions most-recently-active first with exactly one current', () => {
    const sessions = service.listSessions(EMAIL)!;
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    const times = sessions.map((s) => Date.parse(s.lastActiveAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('revokes another session but never the current one', () => {
    const sessions = service.listSessions(EMAIL)!;
    const other = sessions.find((s) => !s.current)!;
    const current = sessions.find((s) => s.current)!;

    expect(service.revokeSession(EMAIL, other.id)).toBe(true);
    expect(service.listSessions(EMAIL)!.some((s) => s.id === other.id)).toBe(false);

    expect(service.revokeSession(EMAIL, current.id)).toBe(false);
    expect(service.listSessions(EMAIL)!.some((s) => s.id === current.id)).toBe(true);
  });

  it('is idempotent when revoking an already-gone session', () => {
    const other = service.listSessions(EMAIL)!.find((s) => !s.current)!;
    expect(service.revokeSession(EMAIL, other.id)).toBe(true);
    expect(service.revokeSession(EMAIL, other.id)).toBe(false);
  });

  it('revokes all other sessions, leaving only the current one (AC-09)', () => {
    const before = service.listSessions(EMAIL)!;
    const otherCount = before.filter((s) => !s.current).length;
    expect(service.revokeOtherSessions(EMAIL)).toBe(otherCount);
    const after = service.listSessions(EMAIL)!;
    expect(after).toHaveLength(1);
    expect(after[0]!.current).toBe(true);
  });
});

describe('users created after construction (sign-up / invite)', () => {
  it('lazily initialises security state so a newly signed-up user is not 401d', async () => {
    // No seed users: the security maps start empty, mirroring a user who signs up at runtime.
    const service = new AuthService([]);
    const signUp = await service.signUp('newcomer@clearline.dev', 'Str0ng-Pass!word');
    expect(signUp.outcome).toBe('success');

    // Every security surface resolves with sane defaults rather than null (which the handler 401s on).
    expect(service.getTwoFactorStatus('newcomer@clearline.dev')).toEqual({
      enabled: false,
      orgEnforced: false,
    });
    expect(service.listSessions('newcomer@clearline.dev')).toHaveLength(1);
    expect(service.listTrustedDevices('newcomer@clearline.dev')).toEqual([]);
    expect(service.revokeOtherSessions('newcomer@clearline.dev')).toBe(0);
  });

  it('still returns null / unknown_user for a genuinely unknown email', () => {
    const service = new AuthService([]);
    expect(service.getTwoFactorStatus('nobody@clearline.dev')).toBeNull();
    expect(service.listSessions('nobody@clearline.dev')).toBeNull();
    expect(service.disableTwoFactor('nobody@clearline.dev').outcome).toBe('unknown_user');
  });
});

describe('trusted devices (AC-10)', () => {
  it('lists and removes trusted devices for the demo account', async () => {
    const { service } = await makeService();
    const devices = service.listTrustedDevices(EMAIL)!;
    expect(devices.length).toBeGreaterThanOrEqual(1);
    const target = devices[0]!;
    expect(service.removeTrustedDevice(EMAIL, target.id)).toBe(true);
    expect(service.listTrustedDevices(EMAIL)!.some((d) => d.id === target.id)).toBe(false);
    // Idempotent second removal.
    expect(service.removeTrustedDevice(EMAIL, target.id)).toBe(false);
  });

  it('clears trusted devices when 2FA is disabled', async () => {
    const { service } = await makeService();
    const setup = service.startTotpSetup(EMAIL)!;
    await service.verifyTotpSetup(EMAIL, await generateTotpCode(setup.secret, NOW), NOW);
    service.disableTwoFactor(EMAIL);
    expect(service.listTrustedDevices(EMAIL)).toEqual([]);
  });
});

describe('security actions never persist secrets in the clear', () => {
  it('does not store the new password anywhere as plaintext', async () => {
    const { service } = await makeService();
    await service.changePassword(EMAIL, PASSWORD, STRONG_NEW);
    const snapshot = JSON.stringify(service.snapshot());
    expect(snapshot).not.toContain(STRONG_NEW);
  });

  it('stores only hashes of backup codes, never the codes themselves', async () => {
    const { service } = await makeService();
    const setup = service.startTotpSetup(EMAIL)!;
    const result = await service.verifyTotpSetup(
      EMAIL,
      await generateTotpCode(setup.secret, NOW),
      NOW,
    );
    if (result.outcome !== 'success') throw new Error('expected success');
    const snapshot = JSON.stringify(service.snapshot());
    for (const code of result.backupCodes) expect(snapshot).not.toContain(code);
  });

  it('leaves the seeded password hash verifiable after unrelated security actions', async () => {
    const { service, user } = await makeService();
    service.startTotpSetup(EMAIL);
    await expect(verifyPassword(PASSWORD, user.passwordHash)).resolves.toBe(true);
  });
});
