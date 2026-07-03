import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, hashResetToken } from '@fintech-portfolio/domain-auth';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';

const PLAINTEXT_PASSWORD = 'Correct-Horse-Battery-1';
const IP = '127.0.0.1 (mocked)';
const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const NEW_PASSWORD = 'New-Horse-Battery-2';

let USER: SeedUser;

beforeAll(async () => {
  USER = {
    id: 'user_1',
    email: 'demo@clearline.dev',
    passwordHash: await hashPassword(PLAINTEXT_PASSWORD),
  };
});

function newService() {
  return new AuthService([USER]);
}

describe('AuthService.requestPasswordReset', () => {
  it('issues a token for a registered email', async () => {
    const service = newService();
    const result = await service.requestPasswordReset(USER.email, NOW);
    expect(result.token).toEqual(expect.any(String));
  });

  it('issues no token for an unregistered email', async () => {
    const service = newService();
    const result = await service.requestPasswordReset('nobody@clearline.dev', NOW);
    expect(result.token).toBeUndefined();
  });

  it('treats email matching as case-insensitive', async () => {
    const service = newService();
    const result = await service.requestPasswordReset(USER.email.toUpperCase(), NOW);
    expect(result.token).toEqual(expect.any(String));
  });

  it('stores the reset token hashed, never in plaintext', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    // Whitebox: reaching into private state is the only way to assert what's actually
    // persisted — this is the one test standing in for "a compromise of the store can't be
    // replayed as a valid link" per the OWASP Forgot Password Cheat Sheet.
    const rawStore = (service as unknown as { resetTokensByTokenHash: Map<string, unknown> })
      .resetTokensByTokenHash;
    expect(rawStore.has(token!)).toBe(false);
    expect(rawStore.has(await hashResetToken(token!))).toBe(true);
  });
});

describe('AuthService.isResetTokenValid', () => {
  it('is true for a freshly issued token', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    expect(await service.isResetTokenValid(token!, NOW)).toBe(true);
  });

  it('is false for an unknown token', async () => {
    const service = newService();
    expect(await service.isResetTokenValid('not-a-real-token', NOW)).toBe(false);
  });

  it('is false for an expired token', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    expect(await service.isResetTokenValid(token!, NOW + HOUR)).toBe(false);
  });

  it('is false for an already-consumed token', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, NEW_PASSWORD, NOW);
    expect(await service.isResetTokenValid(token!, NOW)).toBe(false);
  });
});

describe('AuthService.resetPassword', () => {
  it('updates the password on a valid, unexpired token and lets the new password log in', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    const result = await service.resetPassword(token!, NEW_PASSWORD, NOW);
    expect(result.outcome).toBe('success');

    const oldPasswordAttempt = await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW);
    expect(oldPasswordAttempt.outcome).toBe('invalid_credentials');

    const newPasswordAttempt = await service.login(USER.email, NEW_PASSWORD, IP, NOW);
    expect(newPasswordAttempt.outcome).toBe('success');
  });

  it('rejects reuse of an already-consumed token', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, NEW_PASSWORD, NOW);

    const result = await service.resetPassword(token!, 'Another-Battery-3', NOW);
    expect(result.outcome).toBe('token_invalid');
  });

  it('rejects an unknown token', async () => {
    const service = newService();
    const result = await service.resetPassword('not-a-real-token', NEW_PASSWORD, NOW);
    expect(result.outcome).toBe('token_invalid');
  });

  it('rejects a token more than 1 hour old', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    const result = await service.resetPassword(token!, NEW_PASSWORD, NOW + HOUR);
    expect(result.outcome).toBe('token_expired');
  });

  it('rejects a password that fails the complexity policy without consuming the token', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    const weakResult = await service.resetPassword(token!, 'weak', NOW);
    expect(weakResult.outcome).toBe('weak_password');

    const retryResult = await service.resetPassword(token!, NEW_PASSWORD, NOW);
    expect(retryResult.outcome).toBe('success');
  });

  it('records an audit event on a successful reset', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, NEW_PASSWORD, NOW);

    const event = service.getAuditLog().find((entry) => entry.type === 'password_reset');
    expect(event).toMatchObject({ type: 'password_reset', userId: USER.id, email: USER.email });
  });

  it('revokes every refresh token issued for the account (AC-03)', async () => {
    const service = newService();
    const { accessToken: _accessToken, refreshToken: firstSession } = await service.login(
      USER.email,
      PLAINTEXT_PASSWORD,
      IP,
      NOW,
    );
    const { refreshToken: secondSession } = await service.login(
      USER.email,
      PLAINTEXT_PASSWORD,
      IP,
      NOW,
    );
    expect(service.isRefreshTokenActive(USER.email, firstSession!)).toBe(true);
    expect(service.isRefreshTokenActive(USER.email, secondSession!)).toBe(true);

    const { token } = await service.requestPasswordReset(USER.email, NOW);
    await service.resetPassword(token!, NEW_PASSWORD, NOW);

    expect(service.isRefreshTokenActive(USER.email, firstSession!)).toBe(false);
    expect(service.isRefreshTokenActive(USER.email, secondSession!)).toBe(false);
  });

  it('does not revoke refresh tokens when the reset fails', async () => {
    const service = newService();
    const { refreshToken } = await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW);
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    await service.resetPassword(token!, 'weak', NOW);

    expect(service.isRefreshTokenActive(USER.email, refreshToken!)).toBe(true);
  });

  it('records a password-changed notification on a successful reset (AC-03)', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    await service.resetPassword(token!, NEW_PASSWORD, NOW);

    expect(service.getSentNotifications()).toContainEqual({
      type: 'password_changed',
      email: USER.email,
      timestamp: NOW,
    });
  });

  it('sends no notification when the reset fails', async () => {
    const service = newService();
    const { token } = await service.requestPasswordReset(USER.email, NOW);

    await service.resetPassword(token!, 'weak', NOW);

    expect(service.getSentNotifications()).toHaveLength(0);
  });
});
