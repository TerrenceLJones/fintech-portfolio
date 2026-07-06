import { beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';
import { buildSeedUser } from '../fixtures/test-factories';

const NEW_PASSWORD = 'Brand-New-Password-1!';
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

let VERIFIED_USER: SeedUser;

beforeAll(async () => {
  VERIFIED_USER = await buildSeedUser({ password: 'Correct-Horse-Battery-1' });
});

function newService() {
  return new AuthService([VERIFIED_USER]);
}

async function signUpNewUser(service: AuthService, email: string, now = NOW) {
  const result = await service.signUp(email, NEW_PASSWORD, now);
  return result.verificationToken!;
}

describe('AuthService.verifyEmail', () => {
  it('marks the account verified and auto-logs in with fresh tokens for a valid link (AC-03)', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev');

    const result = await service.verifyEmail(token, NOW + 1000);

    expect(result.outcome).toBe('success');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(
      await service.isRefreshTokenActive('new-owner@clearline.dev', result.refreshToken!),
    ).toBe(true);

    const rawStore = (service as unknown as { usersByEmail: Map<string, SeedUser> }).usersByEmail;
    expect(rawStore.get('new-owner@clearline.dev')?.verified).toBe(true);
  });

  it('records an email_verified audit event on success (AC-03)', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev');
    await service.verifyEmail(token, NOW + 1000);

    expect(service.getAuditLog()).toContainEqual(
      expect.objectContaining({ type: 'email_verified', email: 'new-owner@clearline.dev' }),
    );
  });

  it('rejects an unknown token (edge case)', async () => {
    const service = newService();
    const result = await service.verifyEmail('not-a-real-token', NOW);
    expect(result).toEqual({ outcome: 'token_invalid' });
  });

  it('rejects a token older than 24 hours (AC-05)', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev', NOW);

    const result = await service.verifyEmail(token, NOW + DAY);
    expect(result).toEqual({ outcome: 'token_expired' });
  });

  it('accepts a token just under 24 hours old', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev', NOW);

    const result = await service.verifyEmail(token, NOW + DAY - 1);
    expect(result.outcome).toBe('success');
  });

  it('rejects a reused token after its first successful use (edge case)', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev');
    await service.verifyEmail(token, NOW + 1000);

    const second = await service.verifyEmail(token, NOW + 2000);
    expect(second).toEqual({ outcome: 'token_invalid' });
  });

  it('isVerificationTokenValid mirrors verifyEmail without consuming the token', async () => {
    const service = newService();
    const token = await signUpNewUser(service, 'new-owner@clearline.dev');

    expect(await service.isVerificationTokenValid(token, NOW + 1000)).toBe(true);
    // still valid afterward — isVerificationTokenValid must not mark it used
    expect(await service.isVerificationTokenValid(token, NOW + 2000)).toBe(true);
    expect(await service.isVerificationTokenValid('unknown', NOW)).toBe(false);
  });
});
