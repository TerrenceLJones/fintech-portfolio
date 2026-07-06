import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { authenticatedFetch, subscribeSessionEnded } from './api-client';
import { clearAccessToken, getAccessToken, setAccessToken } from './access-token-store';

const server = registerMswServer();

afterEach(() => {
  clearAccessToken();
});

describe('authenticatedFetch', () => {
  it('attaches the in-memory access token as a Bearer header', async () => {
    setAccessToken('access_original');
    let receivedAuth: string | null = null;
    server.use(
      http.get('*/api/protected', ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await authenticatedFetch('/api/protected');
    expect(receivedAuth).toBe('Bearer access_original');
  });

  it('silently refreshes and replays on a 401 access_token_expired, without the caller seeing it (AC-01)', async () => {
    setAccessToken('access_expired');
    let protectedCallCount = 0;
    server.use(
      http.get('*/api/protected', ({ request }) => {
        protectedCallCount++;
        const auth = request.headers.get('authorization');
        if (auth === 'Bearer access_expired') {
          return HttpResponse.json({ error: 'access_token_expired' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true, auth });
      }),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'access_refreshed' })),
    );

    const response = await authenticatedFetch('/api/protected');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, auth: 'Bearer access_refreshed' });
    expect(protectedCallCount).toBe(2);
    expect(getAccessToken()).toBe('access_refreshed');
  });

  it('single-flights concurrent 401s into one refresh call', async () => {
    setAccessToken('access_expired');
    let refreshCallCount = 0;
    server.use(
      http.get('*/api/protected', ({ request }) => {
        const auth = request.headers.get('authorization');
        if (auth === 'Bearer access_expired') {
          return HttpResponse.json({ error: 'access_token_expired' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post('*/api/auth/refresh', () => {
        refreshCallCount++;
        return HttpResponse.json({ accessToken: 'access_refreshed' });
      }),
    );

    await Promise.all([
      authenticatedFetch('/api/protected'),
      authenticatedFetch('/api/protected'),
      authenticatedFetch('/api/protected'),
    ]);

    expect(refreshCallCount).toBe(1);
  });

  it('reports session ended and does not retry when the refresh itself is rejected as expired (AC-03)', async () => {
    setAccessToken('access_expired');
    const reasons: string[] = [];
    const unsubscribe = subscribeSessionEnded((reason) => reasons.push(reason));
    server.use(
      http.get('*/api/protected', () =>
        HttpResponse.json({ error: 'access_token_expired' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ error: 'session_expired' }, { status: 401 }),
      ),
    );

    const response = await authenticatedFetch('/api/protected');

    expect(response.status).toBe(401);
    expect(reasons).toEqual(['expired']);
    expect(getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('reports session ended immediately for a non-recoverable 401, without attempting a refresh (AC-02/AC-06)', async () => {
    setAccessToken('access_current');
    const reasons: string[] = [];
    const unsubscribe = subscribeSessionEnded((reason) => reasons.push(reason));
    let refreshCallCount = 0;
    server.use(
      http.get('*/api/protected', () =>
        HttpResponse.json({ error: 'session_revoked_password_changed' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => {
        refreshCallCount++;
        return HttpResponse.json({ accessToken: 'irrelevant' });
      }),
    );

    const response = await authenticatedFetch('/api/protected');

    expect(response.status).toBe(401);
    expect(reasons).toEqual(['password_changed']);
    expect(refreshCallCount).toBe(0);
    unsubscribe();
  });

  it('leaves the session intact and returns the original 401 when the refresh call fails on a network error', async () => {
    setAccessToken('access_expired');
    const reasons: string[] = [];
    const unsubscribe = subscribeSessionEnded((reason) => reasons.push(reason));
    server.use(
      http.get('*/api/protected', () =>
        HttpResponse.json({ error: 'access_token_expired' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => HttpResponse.error()),
    );

    const response = await authenticatedFetch('/api/protected');

    expect(response.status).toBe(401);
    expect(reasons).toEqual([]);
    expect(getAccessToken()).toBe('access_expired');
    unsubscribe();
  });
});
