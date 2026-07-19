import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  ConfirmEmailChangeResponse,
  NotificationPrefsResponse,
  ProfileResponse,
  RequestEmailChangeResponse,
  ValidateEmailChangeTokenResponse,
} from '@clearline/contracts';
import { AuthService } from '../services/auth.service';
import { buildSeedUser } from '../fixtures/test-factories';
import { createProfileHandlers } from './profile.handlers';
import { createSessionHandlers } from './session.handlers';

const BASE = 'http://localhost';
const PASSWORD = 'correct-password';

let server: ReturnType<typeof setupServer>;
let authService: AuthService;
let accessToken: string;

async function startWith(email = 'demo@clearline.dev') {
  const user = await buildSeedUser({
    id: 'user_1',
    email,
    password: PASSWORD,
    displayName: 'Demo User',
  });
  authService = new AuthService([user]);
  server = setupServer(
    ...createProfileHandlers(authService),
    ...createSessionHandlers(authService),
  );
  server.listen({ onUnhandledRequest: 'error' });
  const login = await authService.login(email, PASSWORD, '127.0.0.1');
  accessToken = login.accessToken!;
}

function auth(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } };
}

afterEach(() => server?.close());

describe('GET/PATCH /api/profile (AC-01)', () => {
  beforeEach(() => startWith());

  it('returns the caller profile and persists an identity edit', async () => {
    const before = (await (await fetch(`${BASE}/api/profile`, auth())).json()) as ProfileResponse;
    expect(before.email).toBe('demo@clearline.dev');

    const res = await fetch(
      `${BASE}/api/profile`,
      auth({
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Marcus O.', phone: '+1 555', jobTitle: 'CFO' }),
      }),
    );
    const updated = (await res.json()) as ProfileResponse;
    expect(res.status).toBe(200);
    expect(updated).toMatchObject({ displayName: 'Marcus O.', phone: '+1 555', jobTitle: 'CFO' });
  });

  it('401s without a session', async () => {
    const res = await fetch(`${BASE}/api/profile`);
    expect(res.status).toBe(401);
  });
});

describe('avatar (AC-05/06)', () => {
  beforeEach(() => startWith());

  it('sets then removes the avatar, and the change reaches the session', async () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    const set = (await (
      await fetch(
        `${BASE}/api/profile/avatar`,
        auth({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ avatarUrl: dataUrl }),
        }),
      )
    ).json()) as ProfileResponse;
    expect(set.avatarUrl).toBe(dataUrl);
    expect(authService.checkSession(accessToken).avatarUrl).toBe(dataUrl);

    const removed = (await (
      await fetch(`${BASE}/api/profile/avatar`, auth({ method: 'DELETE' }))
    ).json()) as ProfileResponse;
    expect(removed.avatarUrl).toBeNull();
  });
});

describe('email change (AC-03/04)', () => {
  beforeEach(() => startWith());

  async function requestChange(newEmail: string) {
    return fetch(
      `${BASE}/api/profile/email-change`,
      auth({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      }),
    );
  }

  it('records a pending change without swapping the login email, and confirms it', async () => {
    const res = await requestChange('new@clearline.dev');
    const body = (await res.json()) as RequestEmailChangeResponse;
    expect(res.status).toBe(200);
    expect(body.pendingEmail).toBe('new@clearline.dev');
    // Body must NOT leak the token.
    expect(JSON.stringify(body)).not.toContain('emailchange_');
    // Current email still works for login (AC-03).
    expect((await authService.login('demo@clearline.dev', PASSWORD, '127.0.0.1')).outcome).toBe(
      'success',
    );

    const token = (
      await authService.requestEmailChange('demo@clearline.dev', 'newer@clearline.dev')
    ).token!;
    const confirm = (await (
      await fetch(`${BASE}/api/profile/email-change/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    ).json()) as ConfirmEmailChangeResponse;
    expect(confirm.outcome).toBe('success');
    expect(confirm.email).toBe('newer@clearline.dev');
    expect((await authService.login('newer@clearline.dev', PASSWORD, '127.0.0.1')).outcome).toBe(
      'success',
    );
  });

  it('rejects the current address and a malformed one with 422', async () => {
    expect((await requestChange('demo@clearline.dev')).status).toBe(422);
    expect((await requestChange('not-an-email')).status).toBe(422);
  });

  it('reports an expired/used token as invalid via validate and confirm (AC-04)', async () => {
    const token = (
      await authService.requestEmailChange(
        'demo@clearline.dev',
        'later@clearline.dev',
        Date.now() - 25 * 60 * 60 * 1000,
      )
    ).token!;
    const validate = (await (
      await fetch(`${BASE}/api/profile/email-change/validate?token=${token}`)
    ).json()) as ValidateEmailChangeTokenResponse;
    expect(validate.valid).toBe(false);

    const confirm = (await (
      await fetch(`${BASE}/api/profile/email-change/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    ).json()) as ConfirmEmailChangeResponse;
    expect(confirm.outcome).toBe('token_expired');
  });

  it('cancels a pending change', async () => {
    await requestChange('cancel-me@clearline.dev');
    const profile = (await (
      await fetch(`${BASE}/api/profile/email-change`, auth({ method: 'DELETE' }))
    ).json()) as ProfileResponse;
    expect(profile.pendingEmail).toBeNull();
  });
});

describe('notifications (AC-07/08/09)', () => {
  beforeEach(() => startWith());

  it('defaults, updates a single row, and bulk-applies a summary to frequency rows only', async () => {
    const initial = (await (
      await fetch(`${BASE}/api/profile/notifications`, auth())
    ).json()) as NotificationPrefsResponse;
    expect(initial.preferences.length).toBeGreaterThan(0);
    expect(initial.preferences.every((p) => p.email && p.inApp)).toBe(true);

    const patched = (await (
      await fetch(
        `${BASE}/api/profile/notifications/budget_at_80`,
        auth({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: true, inApp: false, frequency: 'daily' }),
        }),
      )
    ).json()) as NotificationPrefsResponse;
    const budget = patched.preferences.find((p) => p.key === 'budget_at_80')!;
    expect(budget).toMatchObject({ email: true, inApp: false, frequency: 'daily' });

    const summary = (await (
      await fetch(
        `${BASE}/api/profile/notifications/summary`,
        auth({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ frequency: 'weekly' }),
        }),
      )
    ).json()) as NotificationPrefsResponse;
    const security = summary.preferences.find((p) => p.key === 'security_alert')!;
    expect(
      summary.preferences
        .filter((p) => p.key !== 'security_alert')
        .every((p) => p.frequency === 'weekly'),
    ).toBe(true);
    expect(security.frequency).toBe('instant');
  });
});
