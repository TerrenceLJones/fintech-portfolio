import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useRefreshToken } from './use-refresh-token';
import { clearAccessToken, getAccessToken } from './access-token-store';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => {
  clearAccessToken();
});

describe('useRefreshToken', () => {
  it('resolves "success" and sets the access token when a session can be resumed (AC-01)', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'access_resumed' })),
    );

    const { result } = renderHook(() => useRefreshToken(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('success');
    expect(getAccessToken()).toBe('access_resumed');
  });

  it('resolves "no-session" when there is no valid refresh-token cookie to resume', async () => {
    server.use(
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ error: 'invalid_token' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useRefreshToken(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('no-session');
    expect(getAccessToken()).toBeNull();
  });

  it('resolves "network-error" — distinct from "no-session" — when the refresh request never completes', async () => {
    server.use(http.post('*/api/auth/refresh', () => HttpResponse.error()));

    const { result } = renderHook(() => useRefreshToken(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('network-error');
  });

  it('does not fire the request when disabled', async () => {
    let callCount = 0;
    server.use(
      http.post('*/api/auth/refresh', () => {
        callCount++;
        return HttpResponse.json({ accessToken: 'access_resumed' });
      }),
    );

    const { result } = renderHook(() => useRefreshToken(false), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(callCount).toBe(0);
  });
});
