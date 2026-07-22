import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createSessionHandlers } from './session.handlers';
import { AuthService } from '../services/auth.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';
import { EXPENSE_CURRENCY } from '../fixtures/expenses.fixture';

const [user] = SEED_USERS;
const IP = '127.0.0.1 (mocked)';

function startServer() {
  const authService = new AuthService();
  const server = setupServer(...createSessionHandlers(authService));
  server.listen({ onUnhandledRequest: 'error' });
  return { server, authService };
}

// MSW's Node interception shares one process-wide cookie jar (tough-cookie) across every
// setupServer() instance — a Set-Cookie from one test is otherwise silently replayed on a later
// test's request to the same host. Giving each test its own host keeps that jar from leaking
// state between tests, without needing to touch MSW's undocumented internals to reset it.
let hostCounter = 0;
function uniqueOrigin(): string {
  hostCounter += 1;
  return `http://session-test-${hostCounter}.example`;
}

function postRefresh(origin: string, cookie?: string) {
  return fetch(`${origin}/api/auth/refresh`, {
    method: 'POST',
    headers: cookie ? { cookie: `refreshToken=${cookie}` } : {},
  });
}

function getSession(origin: string, accessToken?: string) {
  return fetch(`${origin}/api/auth/session`, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

function postLogout(origin: string, cookie?: string) {
  return fetch(`${origin}/api/auth/logout`, {
    method: 'POST',
    headers: cookie ? { cookie: `refreshToken=${cookie}` } : {},
  });
}

describe('POST /api/auth/refresh', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startServer());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('rotates a valid refresh token and sets a new Set-Cookie (AC-01)', async () => {
    const { refreshToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    const response = await postRefresh(uniqueOrigin(), refreshToken);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accessToken: expect.any(String) });
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).not.toContain(`refreshToken=${refreshToken};`);
  });

  it('returns 401 invalid_token with no cookie', async () => {
    const response = await postRefresh(uniqueOrigin());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_token' });
  });

  it('returns 401 invalid_token for a token that was never issued', async () => {
    const response = await postRefresh(uniqueOrigin(), 'never-issued');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_token' });
  });

  it('returns 401 session_revoked_security and clears the cookie on reuse of a stale token (AC-02)', async () => {
    const { refreshToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    await authService.refresh(refreshToken!);

    const response = await postRefresh(uniqueOrigin(), refreshToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'session_revoked_security' });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('returns 401 session_expired once the family is past its TTL (AC-03)', async () => {
    const { refreshToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    authService.expireRefreshTokenFamiliesForE2E(user!.email);

    const response = await postRefresh(uniqueOrigin(), refreshToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'session_expired' });
  });

  it('returns 401 session_revoked_password_changed once the password changes elsewhere (AC-06)', async () => {
    const { refreshToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    const { token } = await authService.requestPasswordReset(user!.email);
    await authService.resetPassword(token!, 'Brand-New-Password-1!');

    const response = await postRefresh(uniqueOrigin(), refreshToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'session_revoked_password_changed' });
  });
});

describe('GET /api/auth/session', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startServer());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns 200 with the user for an active access token', async () => {
    const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    const response = await getSession(uniqueOrigin(), accessToken);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: user!.id,
      email: user!.email,
      displayName: user!.displayName,
      role: user!.role,
      approvalLimit: user!.approvalLimit,
      currency: EXPENSE_CURRENCY,
      isAdmin: user!.isAdmin,
      isOwner: user!.isOwner,
      avatarUrl: null,
      idleTimeoutMinutes: 15,
      twoFactorSetupRequired: false,
    });
  });

  it('returns 401 invalid_token with no Authorization header', async () => {
    const response = await getSession(uniqueOrigin());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_token' });
  });

  it('returns 401 access_token_expired once the access token is stale (AC-01)', async () => {
    const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    authService.expireAccessTokensForE2E(user!.email);

    const response = await getSession(uniqueOrigin(), accessToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'access_token_expired' });
  });

  it('returns 401 session_revoked_password_changed once the password changes elsewhere (AC-06)', async () => {
    const { accessToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    const { token } = await authService.requestPasswordReset(user!.email);
    await authService.resetPassword(token!, 'Brand-New-Password-1!');

    const response = await getSession(uniqueOrigin(), accessToken);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'session_revoked_password_changed' });
  });
});

describe('POST /api/auth/logout', () => {
  let server: ReturnType<typeof setupServer>;
  let authService: AuthService;

  beforeAll(() => {
    ({ server, authService } = startServer());
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns 200, clears the cookie, and revokes the session', async () => {
    const { refreshToken } = await authService.login(user!.email, DEMO_USER_PASSWORD, IP);
    const response = await postLogout(uniqueOrigin(), refreshToken);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await authService.isRefreshTokenActive(user!.email, refreshToken!)).toBe(false);
  });

  it('returns 200 as a no-op with no cookie', async () => {
    const response = await postLogout(uniqueOrigin());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });
});
