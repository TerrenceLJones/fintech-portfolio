import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { VerifyEmailError, useVerifyEmail } from './use-verify-email';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useVerifyEmail', () => {
  it('resolves an access token for a valid link', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () => HttpResponse.json({ accessToken: 'access_1' })),
    );

    const { result } = renderHook(() => useVerifyEmail('verify_abc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ accessToken: 'access_1' });
  });

  it.each([
    ['token_invalid', 400],
    ['token_expired', 400],
  ] as const)('throws a VerifyEmailError with code %s for a %d response', async (code, status) => {
    server.use(
      http.post('*/api/auth/verify-email', () => HttpResponse.json({ error: code }, { status })),
    );

    const { result } = renderHook(() => useVerifyEmail('verify_abc'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(VerifyEmailError);
    expect((result.current.error as VerifyEmailError).code).toBe(code);
  });

  it('surfaces an error state on a network failure', async () => {
    server.use(http.post('*/api/auth/verify-email', () => HttpResponse.error()));

    const { result } = renderHook(() => useVerifyEmail('verify_abc'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fire when the token is null', () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/verify-email', () => {
        requestCount++;
        return HttpResponse.json({ accessToken: 'access_1' });
      }),
    );

    const { result } = renderHook(() => useVerifyEmail(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requestCount).toBe(0);
  });
});
