import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useLogout } from './use-logout';
import { clearAccessToken, getAccessToken, setAccessToken } from './access-token-store';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

afterEach(() => {
  clearAccessToken();
});

describe('useLogout', () => {
  it('clears the in-memory access token on success', async () => {
    setAccessToken('access_current');
    server.use(http.post('*/api/auth/logout', () => HttpResponse.json({})));

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAccessToken()).toBeNull();
  });

  it('still clears the in-memory access token when the network call fails', async () => {
    setAccessToken('access_current');
    server.use(http.post('*/api/auth/logout', () => HttpResponse.error()));

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(getAccessToken()).toBeNull());
  });

  it('retries a network error up to 3 times in the background so the server-side session still gets revoked once reachable', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/logout', () => {
        requestCount++;
        return HttpResponse.error();
      }),
    );

    const { result } = renderHook(() => useLogout({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(requestCount).toBe(4); // 1 initial attempt + 3 retries
  });

  it('reaches the server and revokes the session once connectivity returns mid-retry', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/logout', () => {
        requestCount++;
        if (requestCount < 3) return HttpResponse.error();
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHook(() => useLogout({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestCount).toBe(3);
  });
});
