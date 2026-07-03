import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useValidateResetToken } from './use-validate-reset-token';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useValidateResetToken', () => {
  it('resolves valid: true for a valid token', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () => HttpResponse.json({ valid: true })),
    );

    const { result } = renderHook(() => useValidateResetToken('reset_abc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ valid: true });
  });

  it('resolves valid: false for an expired/unknown token', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () => HttpResponse.json({ valid: false })),
    );

    const { result } = renderHook(() => useValidateResetToken('reset_expired'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ valid: false });
  });

  it('surfaces an error state on a network failure', async () => {
    server.use(http.get('*/api/auth/reset-password/validate', () => HttpResponse.error()));

    const { result } = renderHook(() => useValidateResetToken('reset_abc'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fire when the token is null', () => {
    let requestCount = 0;
    server.use(
      http.get('*/api/auth/reset-password/validate', () => {
        requestCount++;
        return HttpResponse.json({ valid: false });
      }),
    );

    const { result } = renderHook(() => useValidateResetToken(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requestCount).toBe(0);
  });
});
