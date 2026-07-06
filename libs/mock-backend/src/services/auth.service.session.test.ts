import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '@fintech-portfolio/domain-auth';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';

const PLAINTEXT_PASSWORD = 'Correct-Horse-Battery-1';
const IP = '127.0.0.1 (mocked)';
const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

let USER: SeedUser;

beforeAll(async () => {
  USER = {
    id: 'user_1',
    email: 'demo@clearline.dev',
    passwordHash: await hashPassword(PLAINTEXT_PASSWORD),
    verified: true,
  };
});

function newService() {
  return new AuthService([USER]);
}

async function login(service: AuthService, now = NOW) {
  return service.login(USER.email, PLAINTEXT_PASSWORD, IP, now);
}

describe('AuthService.login — hasOtherActiveSession (AC-07)', () => {
  it('is false on the very first login for an account', async () => {
    const service = newService();
    const result = await login(service);
    expect(result.hasOtherActiveSession).toBe(false);
  });

  it('is true when a second device logs in while the first session is still active', async () => {
    const service = newService();
    await login(service);
    const second = await login(service);
    expect(second.hasOtherActiveSession).toBe(true);
  });

  it('does not forcibly end the first session when a second device logs in', async () => {
    const service = newService();
    const first = await login(service);
    await login(service);
    expect(await service.isRefreshTokenActive(USER.email, first.refreshToken!)).toBe(true);
  });

  it('is false again once the only other session has been logged out', async () => {
    const service = newService();
    const first = await login(service);
    await service.logout(first.refreshToken!);
    const second = await login(service);
    expect(second.hasOtherActiveSession).toBe(false);
  });
});

describe('AuthService.refresh (AC-01, AC-02, AC-03)', () => {
  it('rotates a valid token to a fresh access/refresh pair', async () => {
    const service = newService();
    const { refreshToken } = await login(service);
    const result = await service.refresh(refreshToken!, NOW + MINUTE);

    expect(result.outcome).toBe('success');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.refreshToken).not.toBe(refreshToken);
  });

  it('reports invalid for a token that was never issued', async () => {
    const service = newService();
    const result = await service.refresh('refresh_never-issued', NOW);
    expect(result.outcome).toBe('invalid');
  });

  it('reports expired once the family is 30 days past its originating login, without revoking it', async () => {
    const service = newService();
    const { refreshToken } = await login(service, NOW);
    const expired = await service.refresh(refreshToken!, NOW + 30 * DAY);
    expect(expired.outcome).toBe('expired');

    // Not a compromise — presenting it again still reports the same natural expiry, not reuse.
    const again = await service.refresh(refreshToken!, NOW + 30 * DAY);
    expect(again.outcome).toBe('expired');
  });

  it('revokes the whole family and audits an incident when a stale rotated-past token is replayed', async () => {
    const service = newService();
    const { refreshToken: original } = await login(service, NOW);
    const rotated = await service.refresh(original!, NOW + MINUTE);
    expect(rotated.outcome).toBe('success');

    const replay = await service.refresh(original!, NOW + 2 * MINUTE);
    expect(replay.outcome).toBe('reused');

    const event = service
      .getAuditLog()
      .find((entry) => entry.type === 'refresh_token_reuse_detected');
    expect(event).toMatchObject({ type: 'refresh_token_reuse_detected', email: USER.email });

    // The legitimate, freshly-rotated token is also dead now — the whole family was killed.
    const afterRevocation = await service.refresh(rotated.refreshToken!, NOW + 3 * MINUTE);
    expect(afterRevocation).toMatchObject({ outcome: 'revoked', reason: 'reuse_detected' });
  });

  it('records the presenting IP on the reuse-detected audit event when provided, for forensic parity with login_failure/account_locked', async () => {
    const service = newService();
    const { refreshToken: original } = await login(service, NOW);
    await service.refresh(original!, NOW + MINUTE);

    await service.refresh(original!, NOW + 2 * MINUTE, IP);

    const event = service
      .getAuditLog()
      .find((entry) => entry.type === 'refresh_token_reuse_detected');
    expect(event).toMatchObject({ type: 'refresh_token_reuse_detected', ip: IP });
  });

  it('reports revoked with reason password_changed for a family killed by a password reset (AC-06)', async () => {
    const service = newService();
    const { refreshToken } = await login(service, NOW);
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, 'Brand-New-Password-1!', NOW);

    const result = await service.refresh(refreshToken!, NOW + MINUTE);
    expect(result).toMatchObject({ outcome: 'revoked', reason: 'password_changed' });
  });
});

describe('AuthService.checkSession (AC-01, AC-06)', () => {
  it('reports active for a fresh access token', async () => {
    const service = newService();
    const { accessToken } = await login(service, NOW);
    const result = service.checkSession(accessToken!, NOW + MINUTE);
    expect(result).toMatchObject({ outcome: 'active', userId: USER.id, email: USER.email });
  });

  it('reports invalid for a token that was never issued', () => {
    const service = newService();
    expect(service.checkSession('access_never-issued', NOW).outcome).toBe('invalid');
  });

  it('reports expired once the access token is 5 minutes old', async () => {
    const service = newService();
    const { accessToken } = await login(service, NOW);
    expect(service.checkSession(accessToken!, NOW + 5 * MINUTE).outcome).toBe('expired');
  });

  it('reports revoked with reason password_changed once another device changes the password (AC-06)', async () => {
    const service = newService();
    const { accessToken } = await login(service, NOW);
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, 'Brand-New-Password-1!', NOW);

    const result = service.checkSession(accessToken!, NOW + MINUTE);
    expect(result).toMatchObject({ outcome: 'revoked', reason: 'password_changed' });
  });

  it('reports revoked with reason reuse_detected once a stale refresh token has been replayed (AC-02)', async () => {
    const service = newService();
    const { accessToken, refreshToken } = await login(service, NOW);
    await service.refresh(refreshToken!, NOW + MINUTE);
    await service.refresh(refreshToken!, NOW + 2 * MINUTE);

    const result = service.checkSession(accessToken!, NOW + 3 * MINUTE);
    expect(result).toMatchObject({ outcome: 'revoked', reason: 'reuse_detected' });
  });
});

describe('AuthService.logout', () => {
  it('revokes the session so the refresh token is no longer active', async () => {
    const service = newService();
    const { refreshToken } = await login(service, NOW);
    await service.logout(refreshToken!);
    expect(await service.isRefreshTokenActive(USER.email, refreshToken!)).toBe(false);
  });

  it('is a no-op for a token that was never issued', async () => {
    const service = newService();
    await expect(service.logout('refresh_never-issued')).resolves.toBeUndefined();
  });

  it("does not affect a different device's still-active session", async () => {
    const service = newService();
    const deviceA = await login(service, NOW);
    const deviceB = await login(service, NOW);
    await service.logout(deviceA.refreshToken!);
    expect(await service.isRefreshTokenActive(USER.email, deviceB.refreshToken!)).toBe(true);
  });
});
