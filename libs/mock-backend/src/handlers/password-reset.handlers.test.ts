import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createPasswordResetHandlers } from './password-reset.handlers';
import type { AuthService } from '../services/auth.service';
import { SEED_USERS } from '../fixtures/users.fixture';
import {
  buildResetPasswordErrorResponse,
  buildValidateResetTokenResponse,
  startMswServer,
} from '../fixtures/test-factories';

const [user] = SEED_USERS;
const NEW_PASSWORD = 'New-Horse-Battery-2';

function postForgotPassword(email: string) {
  return fetch('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

function getValidateResetToken(token: string) {
  return fetch(
    `http://localhost/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
  );
}

function postResetPassword(token: string, password: string) {
  return fetch('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
}

describe('POST /api/auth/forgot-password', () => {
  let server: ReturnType<typeof setupServer>;

  beforeAll(() => {
    ({ server } = startMswServer(createPasswordResetHandlers));
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns an identical response for a registered and an unregistered email', async () => {
    const registeredResponse = await postForgotPassword(user!.email);
    const registeredBody = await registeredResponse.json();

    const unregisteredResponse = await postForgotPassword('nobody@clearline.dev');
    const unregisteredBody = await unregisteredResponse.json();

    expect(registeredResponse.status).toBe(unregisteredResponse.status);
    expect(registeredBody).toEqual(unregisteredBody);
    expect(registeredResponse.status).toBe(200);
  });

  it('responds without waiting on requestPasswordReset, so response timing cannot leak which branch ran', async () => {
    // A fake whose requestPasswordReset never resolves — if the handler awaited it, this fetch
    // would still be pending when the race below times out, failing the test.
    const neverResolvingAuthService = {
      requestPasswordReset: () => new Promise(() => {}),
    } as unknown as AuthService;
    const isolatedServer = setupServer(...createPasswordResetHandlers(neverResolvingAuthService));
    isolatedServer.listen({ onUnhandledRequest: 'error' });

    try {
      const response = await Promise.race([
        postForgotPassword(user!.email),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('forgot-password response did not resolve in time')),
            50,
          ),
        ),
      ]);
      expect(response.status).toBe(200);
    } finally {
      isolatedServer.close();
    }
  });
});

describe('GET /api/auth/reset-password/validate', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startMswServer(createPasswordResetHandlers));
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns valid: true for a freshly issued token', async () => {
    const { token } = await authService.requestPasswordReset(user!.email, Date.now());
    const response = await getValidateResetToken(token!);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(buildValidateResetTokenResponse());
  });

  it('returns valid: false for an unknown token', async () => {
    const response = await getValidateResetToken('not-a-real-token');
    const body = await response.json();

    expect(body).toEqual(buildValidateResetTokenResponse({ valid: false }));
  });

  it('returns valid: false for an expired token', async () => {
    const issuedAt = Date.now() - 61 * 60 * 1000;
    const { token } = await authService.requestPasswordReset(user!.email, issuedAt);
    const response = await getValidateResetToken(token!);
    const body = await response.json();

    expect(body).toEqual(buildValidateResetTokenResponse({ valid: false }));
  });
});

describe('POST /api/auth/reset-password', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startMswServer(createPasswordResetHandlers));
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns 200 on success and lets the user log in with the new password', async () => {
    const { token } = await authService.requestPasswordReset(user!.email, Date.now());
    const response = await postResetPassword(token!, NEW_PASSWORD);

    expect(response.status).toBe(200);
    const loginResult = await authService.login(user!.email, NEW_PASSWORD, '127.0.0.1', Date.now());
    expect(loginResult.outcome).toBe('success');
  });

  it('returns 400 token_invalid for an unknown token', async () => {
    const response = await postResetPassword('not-a-real-token', NEW_PASSWORD);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual(buildResetPasswordErrorResponse({ error: 'token_invalid' }));
  });

  it('returns 400 token_expired for an expired token', async () => {
    const issuedAt = Date.now() - 61 * 60 * 1000;
    const { token } = await authService.requestPasswordReset(user!.email, issuedAt);
    const response = await postResetPassword(token!, NEW_PASSWORD);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual(buildResetPasswordErrorResponse({ error: 'token_expired' }));
  });

  it('returns 422 weak_password for a password failing the complexity policy', async () => {
    const { token } = await authService.requestPasswordReset(user!.email, Date.now());
    const response = await postResetPassword(token!, 'weak');
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual(buildResetPasswordErrorResponse({ error: 'weak_password' }));
  });
});
