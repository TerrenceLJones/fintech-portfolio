import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { ResetPasswordError, useResetPassword } from './use-reset-password';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useResetPassword', () => {
  it('resolves on a 200 response', async () => {
    server.use(http.post('*/api/auth/reset-password', () => HttpResponse.json({})));

    const { result } = renderHook(() => useResetPassword(), { wrapper });
    result.current.mutate({ token: 'reset_abc', password: 'New-Horse-Battery-2' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each([
    ['token_invalid', 400],
    ['token_expired', 400],
    ['weak_password', 422],
  ] as const)(
    'throws a ResetPasswordError with code %s for a %d response',
    async (code, status) => {
      server.use(
        http.post('*/api/auth/reset-password', () =>
          HttpResponse.json({ error: code }, { status }),
        ),
      );

      const { result } = renderHook(() => useResetPassword(), { wrapper });
      result.current.mutate({ token: 'reset_abc', password: 'New-Horse-Battery-2' });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ResetPasswordError);
      expect((result.current.error as ResetPasswordError).code).toBe(code);
    },
  );

  it('throws a plain error on a network failure', async () => {
    server.use(http.post('*/api/auth/reset-password', () => HttpResponse.error()));

    const { result } = renderHook(() => useResetPassword(), { wrapper });
    result.current.mutate({ token: 'reset_abc', password: 'New-Horse-Battery-2' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(ResetPasswordError);
  });
});
