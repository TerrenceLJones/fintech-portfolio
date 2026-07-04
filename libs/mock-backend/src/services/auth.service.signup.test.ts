import { beforeAll, describe, expect, it } from 'vitest';
import { hashToken } from '@fintech-portfolio/domain-auth';
import { AuthService } from './auth.service';
import type { SeedUser } from '../fixtures/users.fixture';
import { buildSeedUser } from '../fixtures/test-factories';

const EXISTING_PASSWORD = 'Correct-Horse-Battery-1';
const NEW_PASSWORD = 'Brand-New-Password-1!';
const NOW = 1_700_000_000_000;

let VERIFIED_USER: SeedUser;

beforeAll(async () => {
  VERIFIED_USER = await buildSeedUser({ password: EXISTING_PASSWORD });
});

function newService() {
  return new AuthService([VERIFIED_USER]);
}

describe('AuthService.signUp', () => {
  it('creates an unverified account and issues a verification token for a new email (AC-01)', async () => {
    const service = newService();
    const result = await service.signUp('new-owner@clearline.dev', NEW_PASSWORD, NOW);

    expect(result.outcome).toBe('success');
    expect(result.verificationToken).toBeDefined();

    const rawStore = (
      service as unknown as {
        usersByEmail: Map<string, SeedUser>;
      }
    ).usersByEmail;
    const created = rawStore.get('new-owner@clearline.dev');
    expect(created?.verified).toBe(false);
    expect(created?.id).toBeDefined();
  });

  it('stores only the verification token hash, never the raw token (AC-01)', async () => {
    const service = newService();
    const result = await service.signUp('new-owner@clearline.dev', NEW_PASSWORD, NOW);

    const rawStore = (service as unknown as { verificationTokensByTokenHash: Map<string, unknown> })
      .verificationTokensByTokenHash;
    expect(rawStore.has(result.verificationToken!)).toBe(false);
    expect(rawStore.has(await hashToken(result.verificationToken!))).toBe(true);
  });

  it('sends a verification notification for a new sign-up (AC-01)', async () => {
    const service = newService();
    await service.signUp('new-owner@clearline.dev', NEW_PASSWORD, NOW);

    expect(service.getSentNotifications()).toContainEqual({
      type: 'signup_verification',
      email: 'new-owner@clearline.dev',
      timestamp: NOW,
    });
  });

  it('does not mint a verification token for an email that is already registered and verified (AC-02)', async () => {
    const service = newService();
    const result = await service.signUp(VERIFIED_USER.email, NEW_PASSWORD, NOW);

    expect(result.outcome).toBe('success');
    expect(result.verificationToken).toBeUndefined();
  });

  it('does not create a second account for an already-registered, verified email (AC-02)', async () => {
    const service = newService();
    await service.signUp(VERIFIED_USER.email, NEW_PASSWORD, NOW);

    const rawStore = (service as unknown as { usersByEmail: Map<string, SeedUser> }).usersByEmail;
    expect(rawStore.size).toBe(1);
    // the existing account's password must be untouched by the signup attempt
    expect(rawStore.get(VERIFIED_USER.email)?.passwordHash).toBe(VERIFIED_USER.passwordHash);
  });

  it('notifies the existing account owner with an "already registered" notice, not a verification email (AC-02)', async () => {
    const service = newService();
    await service.signUp(VERIFIED_USER.email, NEW_PASSWORD, NOW);

    expect(service.getSentNotifications()).toContainEqual({
      type: 'signup_existing_account',
      email: VERIFIED_USER.email,
      timestamp: NOW,
    });
  });

  it('rejects a password that fails sign-up complexity requirements without creating an account (AC-04)', async () => {
    const service = newService();
    const result = await service.signUp('weak-pw@clearline.dev', 'weak', NOW);

    expect(result).toEqual({ outcome: 'weak_password' });
    const rawStore = (service as unknown as { usersByEmail: Map<string, SeedUser> }).usersByEmail;
    expect(rawStore.has('weak-pw@clearline.dev')).toBe(false);
    expect(service.getSentNotifications()).toHaveLength(0);
  });

  it('is case-insensitive when matching an email to an existing account', async () => {
    const service = newService();
    const result = await service.signUp(VERIFIED_USER.email.toUpperCase(), NEW_PASSWORD, NOW);

    expect(result.verificationToken).toBeUndefined();
  });

  it('resubmitting sign-up for a still-unverified email mints a fresh token without creating a duplicate account (edge case)', async () => {
    const service = newService();
    const first = await service.signUp('pending@clearline.dev', NEW_PASSWORD, NOW);
    const second = await service.signUp('pending@clearline.dev', NEW_PASSWORD, NOW + 1000);

    expect(first.verificationToken).toBeDefined();
    expect(second.verificationToken).toBeDefined();
    expect(second.verificationToken).not.toBe(first.verificationToken);

    const rawStore = (service as unknown as { usersByEmail: Map<string, SeedUser> }).usersByEmail;
    expect(rawStore.size).toBe(2); // VERIFIED_USER (seeded) + this one unverified user
  });
});
