import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createAuthHandlers } from './auth.handlers';
import { DEMO_USER_PASSWORD, SEED_USERS } from '../fixtures/users.fixture';
import { startMswServer } from '../fixtures/test-factories';

const [user] = SEED_USERS;

function postLogin(email: string, password: string) {
  return fetch('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

describe('POST /api/auth/login', () => {
  let server: ReturnType<typeof setupServer>;

  beforeAll(() => {
    ({ server } = startMswServer(createAuthHandlers));
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns 200 with an access token and a Set-Cookie refresh token on success', async () => {
    const response = await postLogin(user!.email, DEMO_USER_PASSWORD);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accessToken: expect.any(String) });

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('returns a generic 401 for a wrong password', async () => {
    const response = await postLogin(user!.email, 'wrong-password');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'invalid_credentials' });
  });

  it('returns the identical generic 401 for an unregistered email', async () => {
    const response = await postLogin('nobody@clearline.dev', 'whatever');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'invalid_credentials' });
  });
});

describe('POST /api/auth/login — lockout (isolated service instance)', () => {
  let server: ReturnType<typeof setupServer>;

  beforeAll(() => {
    ({ server } = startMswServer(createAuthHandlers));
  });
  afterAll(() => server.close());

  it('returns 423 with a support reference ID on the 5th failed attempt', async () => {
    for (let i = 0; i < 4; i++) {
      await postLogin(user!.email, 'wrong-password');
    }
    const response = await postLogin(user!.email, 'wrong-password');
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body).toMatchObject({ error: 'account_locked', supportReferenceId: expect.any(String) });
  });
});
