import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { LoginError, useLogin } from './use-login';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useLogin', () => {
  it('resolves with the access token on success', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'access_123' })),
    );

    const { result } = renderHook(() => useLogin({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev', password: 'correct' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ accessToken: 'access_123' });
  });

  it('does not retry a 401 invalid_credentials response', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/login', () => {
        requestCount++;
        return HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 });
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
});
