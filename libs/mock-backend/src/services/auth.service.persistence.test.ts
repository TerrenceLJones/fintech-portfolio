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

describe('AuthService snapshot/restore — refresh-token family state', () => {
  it('round-trips the refresh-token family so it can still be rotated after restore, but does not carry the access token over', async () => {
    const service = new AuthService([VERIFIED_USER]);
    const { accessToken, refreshToken } = await service.login(
      VERIFIED_USER.email,
      'Correct-Horse-Battery-1',
      '127.0.0.1 (mocked)',
      NOW,
    );

    const restored = new AuthService([VERIFIED_USER]);
    restored.restore(service.snapshot());

    // Access tokens are deliberately not persisted (see AuthService.snapshot) — a restore always
    // implies a reload, which already clears the client's in-memory copy by design, so the client
    // re-establishes a fresh one via silent refresh regardless.
    expect(restored.checkSession(accessToken!, NOW).outcome).toBe('invalid');
    const rotated = await restored.refresh(refreshToken!, NOW);
    expect(rotated.outcome).toBe('success');
  });

  it('round-trips an already-used token hash, so a stale replay is still detected as reuse after restore', async () => {
    const service = new AuthService([VERIFIED_USER]);
    const { refreshToken: original } = await service.login(
      VERIFIED_USER.email,
      'Correct-Horse-Battery-1',
      '127.0.0.1 (mocked)',
      NOW,
    );
    await service.refresh(original!, NOW);

    const restored = new AuthService([VERIFIED_USER]);
    restored.restore(service.snapshot());

    const replay = await restored.refresh(original!, NOW);
    expect(replay.outcome).toBe('reused');
  });
});
