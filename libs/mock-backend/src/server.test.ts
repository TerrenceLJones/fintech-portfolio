import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from './server';
import { sharedAuthService } from './services/shared-auth-service';
import { DEMO_USER_PASSWORD, SEED_USERS } from './fixtures/users.fixture';

const [user] = SEED_USERS;
const NEW_PASSWORD = 'New-Horse-Battery-2';

function postLogin(email: string, password: string) {
  return fetch('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

function postForgotPassword(email: string) {
  return fetch('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

function postResetPassword(token: string, password: string) {
  return fetch('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
}

/**
 * Exercises `server` — the real wiring the app boots (see browser.ts/server.ts) — rather than a
 * fresh AuthService per test, because that's the only way to catch the login/password-reset
 * handlers not actually sharing state: previously each handler module built its own default
 * `AuthService`, so a reset here would never be visible to a subsequent login here.
 */
describe('login and password-reset handlers share one AuthService instance', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lets the user log in with a new password, and locks out the old one, after a reset', async () => {
    const forgotResponse = await postForgotPassword(user!.email);
    expect(forgotResponse.status).toBe(200);

    // The forgot-password response discards the token by design (AC-01, no enumeration) — the
    // only way to recover it, here as in a real inbox, is through the side channel it would
    // travel over (an emailed link), not the API response. Reaching directly into the shared
    // service is this test's stand-in for that.
    const { token } = await sharedAuthService.requestPasswordReset(user!.email);
    const resetResponse = await postResetPassword(token!, NEW_PASSWORD);
    expect(resetResponse.status).toBe(200);

    const oldPasswordLogin = await postLogin(user!.email, DEMO_USER_PASSWORD);
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await postLogin(user!.email, NEW_PASSWORD);
    expect(newPasswordLogin.status).toBe(200);
  });
});
