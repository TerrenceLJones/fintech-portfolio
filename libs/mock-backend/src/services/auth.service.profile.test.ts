import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { buildSeedUser } from '../fixtures/test-factories';

const PASSWORD = 'correct-password';

async function serviceWith(...emails: string[]) {
  const users = await Promise.all(
    emails.map((email, index) =>
      buildSeedUser({ id: `user_${index + 1}`, email, password: PASSWORD, displayName: email }),
    ),
  );
  return new AuthService(users);
}

describe('AuthService — profile identity & avatar (US-CW-034 AC-01/05/06)', () => {
  it('updates name/phone/job title and clears the avatar back to null', async () => {
    const service = await serviceWith('demo@clearline.dev');
    service.updateProfile('demo@clearline.dev', {
      displayName: 'Marcus O.',
      phone: '+1 555',
      jobTitle: 'CFO',
    });
    service.setAvatar('demo@clearline.dev', 'data:image/png;base64,AAAA');
    expect(service.getProfile('demo@clearline.dev')).toMatchObject({
      displayName: 'Marcus O.',
      phone: '+1 555',
      jobTitle: 'CFO',
      avatarUrl: 'data:image/png;base64,AAAA',
    });
    expect(service.removeAvatar('demo@clearline.dev')?.avatarUrl).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    const service = await serviceWith('demo@clearline.dev');
    expect(service.getProfile('nobody@clearline.dev')).toBeNull();
  });
});

describe('AuthService — email change (US-CW-034 AC-03/04)', () => {
  it('confirming swaps the login email: the old address stops working, the new one works', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const { token, outcome } = await service.requestEmailChange(
      'demo@clearline.dev',
      'new@clearline.dev',
    );
    expect(outcome).toBe('success');
    // Old address still authenticates until confirmation (AC-03).
    expect((await service.login('demo@clearline.dev', PASSWORD, '127.0.0.1')).outcome).toBe(
      'success',
    );

    expect((await service.confirmEmailChange(token!)).outcome).toBe('success');
    expect((await service.login('new@clearline.dev', PASSWORD, '127.0.0.1')).outcome).toBe(
      'success',
    );
    expect((await service.login('demo@clearline.dev', PASSWORD, '127.0.0.1')).outcome).toBe(
      'invalid_credentials',
    );
  });

  it('rejects a new address already owned by another account', async () => {
    const service = await serviceWith('demo@clearline.dev', 'taken@clearline.dev');
    expect(
      (await service.requestEmailChange('demo@clearline.dev', 'taken@clearline.dev')).outcome,
    ).toBe('email_taken');
  });

  it('supersedes a prior pending token so only one change can be confirmed (edge case)', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const first = await service.requestEmailChange('demo@clearline.dev', 'first@clearline.dev');
    const second = await service.requestEmailChange('demo@clearline.dev', 'second@clearline.dev');

    // The first token is now invalid; only the second confirms.
    expect(await service.isEmailChangeTokenValid(first.token!)).toBe(false);
    expect((await service.confirmEmailChange(first.token!)).outcome).toBe('token_invalid');
    expect((await service.confirmEmailChange(second.token!)).outcome).toBe('success');
    expect(service.getProfile('second@clearline.dev')?.email).toBe('second@clearline.dev');
  });

  it('an expired token leaves the email unchanged and clears the stale pending marker (AC-04)', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const { token } = await service.requestEmailChange(
      'demo@clearline.dev',
      'late@clearline.dev',
      Date.now() - 25 * 60 * 60 * 1000,
    );
    expect((await service.confirmEmailChange(token!)).outcome).toBe('token_expired');
    const profile = service.getProfile('demo@clearline.dev');
    expect(profile?.email).toBe('demo@clearline.dev');
    expect(profile?.pendingEmail).toBeNull();
  });

  it('cancel invalidates the outstanding token and clears the pending marker', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const { token } = await service.requestEmailChange(
      'demo@clearline.dev',
      'cancel@clearline.dev',
    );
    service.cancelEmailChange('demo@clearline.dev');
    expect(await service.isEmailChangeTokenValid(token!)).toBe(false);
    expect(service.getProfile('demo@clearline.dev')?.pendingEmail).toBeNull();
  });
});

describe('AuthService — notification preferences (US-CW-034 AC-07/09)', () => {
  it('defaults to all-on/instant, and a per-row override wins over a later reading', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const defaults = service.getNotificationPrefs('demo@clearline.dev')!;
    expect(defaults.every((p) => p.email && p.inApp && p.frequency === 'instant')).toBe(true);

    service.setNotificationPref('demo@clearline.dev', 'budget_at_80', {
      email: true,
      inApp: false,
      frequency: 'daily',
    });
    const after = service.getNotificationPrefs('demo@clearline.dev')!;
    expect(after.find((p) => p.key === 'budget_at_80')).toMatchObject({
      inApp: false,
      frequency: 'daily',
    });
  });

  it('bulk summary sets every frequency-supporting row and leaves security alerts untouched (AC-09)', async () => {
    const service = await serviceWith('demo@clearline.dev');
    const prefs = service.applyNotificationSummary('demo@clearline.dev', 'weekly')!;
    expect(
      prefs.filter((p) => p.key !== 'security_alert').every((p) => p.frequency === 'weekly'),
    ).toBe(true);
    expect(prefs.find((p) => p.key === 'security_alert')?.frequency).toBe('instant');
  });
});
