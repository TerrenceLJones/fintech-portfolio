import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useSession } from './use-session';
import { clearAccessToken, setAccessToken } from './access-token-store';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => {
  clearAccessToken();
});

describe('useSession', () => {
  it('resolves with the current user for an active access token (AC-01)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ userId: 'user_1', email: 'demo@clearline.dev' }),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ userId: 'user_1', email: 'demo@clearline.dev' });
  });

  it('silently refreshes and resolves once an expired access token is transparently recovered (AC-01)', async () => {
    setAccessToken('access_expired');
    server.use(
      http.get('*/api/auth/session', ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer access_expired') {
          return HttpResponse.json({ error: 'access_token_expired' }, { status: 401 });
        }
        return HttpResponse.json({ userId: 'user_1', email: 'demo@clearline.dev' });
      }),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'access_fresh' })),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ userId: 'user_1', email: 'demo@clearline.dev' });
  });

  it('surfaces an error when the session cannot be recovered', async () => {
    setAccessToken('access_revoked');
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ error: 'session_revoked_security' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
