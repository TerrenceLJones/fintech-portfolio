import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import type {
  SignUpErrorResponse,
  SignUpResponse,
  VerifyEmailErrorResponse,
  VerifyEmailResponse,
} from '@fintech-portfolio/contracts';
import { createSignUpHandlers } from './signup.handlers';
import { AuthService } from '../services/auth.service';
import { SEED_USERS } from '../fixtures/users.fixture';

const [user] = SEED_USERS;
const NEW_PASSWORD = 'Brand-New-Password-1!';

function startServerWithFreshService() {
  const authService = new AuthService();
  const server = setupServer(...createSignUpHandlers(authService));
  server.listen({ onUnhandledRequest: 'error' });
  return { server, authService };
}

function postSignUp(email: string, password: string) {
  return fetch('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

function postVerifyEmail(token: string) {
  return fetch('http://localhost/api/auth/verify-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

describe('POST /api/auth/signup', () => {
  let server: ReturnType<typeof setupServer>;

  beforeAll(() => {
    ({ server } = startServerWithFreshService());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns an identical 200 empty body for a new email and an already-registered, verified email (AC-01, AC-02)', async () => {
    const newEmailResponse = await postSignUp('new-owner@clearline.dev', NEW_PASSWORD);
    const newEmailBody = (await newEmailResponse.json()) as SignUpResponse;

    const existingEmailResponse = await postSignUp(user!.email, NEW_PASSWORD);
    const existingEmailBody = (await existingEmailResponse.json()) as SignUpResponse;

    expect(newEmailResponse.status).toBe(existingEmailResponse.status);
    expect(newEmailResponse.status).toBe(200);
    expect(newEmailBody).toEqual({});
    expect(existingEmailBody).toEqual({});
  });

  it('returns 422 weak_password for a password failing sign-up complexity requirements (AC-04)', async () => {
    const response = await postSignUp('weak-pw@clearline.dev', 'weak');
    const body = (await response.json()) as SignUpErrorResponse;

    expect(response.status).toBe(422);
    expect(body).toEqual({ error: 'weak_password' });
  });
});

describe('POST /api/auth/verify-email', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startServerWithFreshService());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns 200 with an access token and a Set-Cookie refresh token for a valid link (AC-03)', async () => {
    const { verificationToken } = await authService.signUp('new-owner@clearline.dev', NEW_PASSWORD);
    const response = await postVerifyEmail(verificationToken!);

    expect(response.status).toBe(200);
    const body = (await response.json()) as VerifyEmailResponse;
    expect(body.accessToken).toBeDefined();
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
  });

  it('returns 400 token_invalid for an unknown token', async () => {
    const response = await postVerifyEmail('not-a-real-token');
    const body = (await response.json()) as VerifyEmailErrorResponse;

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'token_invalid' });
  });

  it('returns 400 token_expired for a link older than 24 hours (AC-05)', async () => {
    const issuedAt = Date.now() - (24 * 60 * 60 * 1000 + 60_000);
    const { verificationToken } = await authService.signUp(
      'expired-link@clearline.dev',
      NEW_PASSWORD,
      issuedAt,
    );
    const response = await postVerifyEmail(verificationToken!);
    const body = (await response.json()) as VerifyEmailErrorResponse;

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'token_expired' });
  });

  it('returns 400 token_invalid for a token that has already been used once', async () => {
    const { verificationToken } = await authService.signUp(
      'reused-link@clearline.dev',
      NEW_PASSWORD,
    );
    await postVerifyEmail(verificationToken!);

    const response = await postVerifyEmail(verificationToken!);
    const body = (await response.json()) as VerifyEmailErrorResponse;

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'token_invalid' });
  });
});
