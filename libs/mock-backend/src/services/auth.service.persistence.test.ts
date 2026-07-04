import { beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';
import { buildSeedUser } from '../fixtures/test-factories';

const NEW_PASSWORD = 'Brand-New-Password-1!';
const NOW = 1_700_000_000_000;

let VERIFIED_USER: SeedUser;

beforeAll(async () => {
  VERIFIED_USER = await buildSeedUser({ password: 'Correct-Horse-Battery-1' });
});

describe('AuthService snapshot/restore — verification state', () => {
  it('round-trips an unverified account and its verification token through snapshot/restore', async () => {
    const service = new AuthService([VERIFIED_USER]);
    const { verificationToken } = await service.signUp(
      'new-owner@clearline.dev',
      NEW_PASSWORD,
      NOW,
    );

    const restored = new AuthService([VERIFIED_USER]);
    restored.restore(service.snapshot());

    // the unverified user survived the round-trip
    const usersByEmail = (restored as unknown as { usersByEmail: Map<string, SeedUser> })
      .usersByEmail;
    expect(usersByEmail.get('new-owner@clearline.dev')?.verified).toBe(false);

    // and the token minted before the snapshot still verifies against the restored instance
    const result = await restored.verifyEmail(verificationToken!, NOW + 1000);
    expect(result.outcome).toBe('success');
  });
});
