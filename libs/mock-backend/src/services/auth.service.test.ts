import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '@fintech-portfolio/domain-auth';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';

const PLAINTEXT_PASSWORD = 'correct-password';
const IP = '127.0.0.1 (mocked)';
const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;

let USER: SeedUser;

beforeAll(async () => {
  USER = { id: 'user_1', email: 'demo@clearline.dev', passwordHash: await hashPassword(PLAINTEXT_PASSWORD) };
});

function newService() {
  return new AuthService([USER]);
}

describe('AuthService.login', () => {
  it('succeeds with the correct email and password', async () => {
    const service = newService();
    const result = await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW);

    expect(result.outcome).toBe('success');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it('records an audit event on success', async () => {
    const service = newService();
    await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW);

    const [event] = service.getAuditLog();
    expect(event).toMatchObject({
      type: 'login_success',
      userId: USER.id,
      email: USER.email,
      ip: IP,
      timestamp: NOW,
    });
  });

  it('records an audit event on a single failed attempt', async () => {
    const service = newService();
    await service.login(USER.email, 'wrong-password', IP, NOW);

    const [event] = service.getAuditLog();
    expect(event).toMatchObject({ type: 'login_failure', email: USER.email, ip: IP, timestamp: NOW });
  });

  it('resets the failed-attempt count after a successful login', async () => {
    const service = newService();
    for (let i = 0; i < 4; i++) {
      await service.login(USER.email, 'wrong-password', IP, NOW + i * MINUTE);
    }
    const successResult = await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW + 4 * MINUTE);
    expect(successResult.outcome).toBe('success');

    // A single failure after the success must not lock the account — if the pre-success
    // failures were still counted, this would be the 5th failure within the window and lock.
    const result = await service.login(USER.email, 'wrong-password', IP, NOW + 5 * MINUTE);
    expect(result.outcome).toBe('invalid_credentials');
  });

  it('treats email matching as case-insensitive for both auth and lockout tracking', async () => {
    const service = newService();
    const result = await service.login(USER.email.toUpperCase(), PLAINTEXT_PASSWORD, IP, NOW);
    expect(result.outcome).toBe('success');

    for (let i = 0; i < 4; i++) {
      await service.login('Demo@Clearline.Dev', 'wrong-password', IP, NOW + i * MINUTE);
    }
    const lockedResult = await service.login(
      USER.email.toLowerCase(),
      'wrong-password',
      IP,
      NOW + 4 * MINUTE,
    );
    expect(lockedResult.outcome).toBe('account_locked');
  });

  it('returns an identical invalid_credentials result for a wrong password on a registered email', async () => {
    const service = newService();
    const result = await service.login(USER.email, 'wrong-password', IP, NOW);

    expect(result).toEqual({ outcome: 'invalid_credentials' });
  });

  it('returns the exact same invalid_credentials result for an unregistered email', async () => {
    const service = newService();
    const result = await service.login('nobody@clearline.dev', 'whatever', IP, NOW);

    expect(result).toEqual({ outcome: 'invalid_credentials' });
  });

  it('locks the account on the 5th failed attempt within 15 minutes and returns a support reference ID', async () => {
    const service = newService();
    for (let i = 0; i < 4; i++) {
      await service.login(USER.email, 'wrong-password', IP, NOW + i * MINUTE);
    }
    const result = await service.login(USER.email, 'wrong-password', IP, NOW + 4 * MINUTE);

    expect(result.outcome).toBe('account_locked');
    expect(result.supportReferenceId).toEqual(expect.any(String));
  });

  it('records an audit event flagging the lockout, identifiable by email and support reference ID', async () => {
    const service = newService();
    let result;
    for (let i = 0; i < 5; i++) {
      result = await service.login(USER.email, 'wrong-password', IP, NOW + i * MINUTE);
    }

    const lockoutEvent = service.getAuditLog().find((event) => event.type === 'account_locked');
    expect(lockoutEvent).toMatchObject({
      type: 'account_locked',
      email: USER.email,
      supportReferenceId: result?.supportReferenceId,
      ip: IP,
    });
  });

  it('records the attempted email on a lockout audit event even for an unregistered email', async () => {
    const service = newService();
    for (let i = 0; i < 5; i++) {
      await service.login('nobody@clearline.dev', 'whatever', IP, NOW + i * MINUTE);
    }

    const lockoutEvent = service.getAuditLog().find((event) => event.type === 'account_locked');
    expect(lockoutEvent).toMatchObject({ type: 'account_locked', email: 'nobody@clearline.dev' });
    expect(lockoutEvent?.userId).toBeUndefined();
  });

  it('also locks out an unregistered email after 5 failed attempts (enumeration-safe)', async () => {
    const service = newService();
    let result;
    for (let i = 0; i < 5; i++) {
      result = await service.login('nobody@clearline.dev', 'whatever', IP, NOW + i * MINUTE);
    }

    expect(result?.outcome).toBe('account_locked');
  });

  it('keeps returning account_locked even with the correct password while locked', async () => {
    const service = newService();
    for (let i = 0; i < 5; i++) {
      await service.login(USER.email, 'wrong-password', IP, NOW + i * MINUTE);
    }
    const result = await service.login(USER.email, PLAINTEXT_PASSWORD, IP, NOW + 5 * MINUTE);

    expect(result.outcome).toBe('account_locked');
  });

  it('does not count a failed attempt that has aged out of the 15-minute window', async () => {
    const service = newService();
    // 1 stale attempt (ages out) + 4 recent attempts (including the final check) — if the
    // stale one still counted, this would be the 5th recent failure and would lock.
    await service.login(USER.email, 'wrong-password', IP, NOW);
    for (let i = 0; i < 3; i++) {
      await service.login(USER.email, 'wrong-password', IP, NOW + 16 * MINUTE + i * MINUTE);
    }
    const result = await service.login(USER.email, 'wrong-password', IP, NOW + 16 * MINUTE + 3 * MINUTE);

    expect(result.outcome).toBe('invalid_credentials');
  });
});
