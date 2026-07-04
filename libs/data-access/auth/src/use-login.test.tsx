import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { LoginError, useLogin } from './use-login';
import {
  buildAuthErrorResponse,
  buildLoginSuccessResponse,
  registerMswServer,
} from '@fintech-portfolio/mock-backend/test-factories';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useLogin', () => {
  it('resolves with the access token on success', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(buildLoginSuccessResponse())));

    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'correct' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(buildLoginSuccessResponse());
  });

  it('does not retry a 401 invalid_credentials response', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        requestCount++;
        return HttpResponse.json(buildAuthErrorResponse({ error: 'invalid_credentials' }), {
          status: 401,
        });
      }),
    );

    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'wrong' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requestCount).toBe(1);
    expect(result.current.error).toBeInstanceOf(LoginError);
    expect((result.current.error as LoginError).code).toBe('invalid_credentials');
  });

  it('retries a 500 response the same way as a network error', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        requestCount++;
        return HttpResponse.json({ error: 'server_error' }, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'correct' });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(requestCount).toBe(4); // 1 initial attempt + 3 retries
    expect(result.current.error).not.toBeInstanceOf(LoginError);
  });

  it('retries a network error up to 3 times before giving up', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        requestCount++;
        return HttpResponse.error();
      }),
    );

    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'correct' });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(requestCount).toBe(4); // 1 initial attempt + 3 retries
  });

  it('exposes a failed attempt via failureReason while still retrying, not via isError', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        requestCount++;
        return HttpResponse.json({ error: 'server_error' }, { status: 500 });
      }),
    );

    // A non-zero delay (rather than the 0ms other tests use) opens a real window between the
    // first failed attempt and the second one firing, so the mid-retry state below is
    // deterministically observable instead of racing the retry loop.
    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 50 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'correct' });

    // isPending and isError are mutually exclusive statuses in TanStack Query, so error/isError
    // stay unset for the whole retry window and only populate once retries are exhausted.
    // failureReason is the field that updates on every failed attempt while still pending — this
    // is what LoginPage.tsx must read to render "Retrying…" mid-retry (US-CW-001 AC-05).
    await waitFor(() => expect(result.current.failureReason).not.toBeNull());
    expect(result.current.isPending).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.isPending).toBe(false);
    expect(requestCount).toBe(4); // 1 initial attempt + 3 retries
  });
});
