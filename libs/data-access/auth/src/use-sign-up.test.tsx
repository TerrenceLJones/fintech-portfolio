import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SignUpError, useSignUp } from './use-sign-up';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useSignUp', () => {
  it('resolves on a 200 response', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.json({})));

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'new-owner@clearline.dev', password: 'Correct-Horse-1!ab' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('throws a SignUpError with code weak_password for a 422 response', async () => {
    server.use(
      http.post('*/api/auth/signup', () =>
        HttpResponse.json({ error: 'weak_password' }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'weak@clearline.dev', password: 'weak' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(SignUpError);
    expect((result.current.error as SignUpError).code).toBe('weak_password');
  });

  it('throws a plain error on a network failure', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.error()));

    const { result } = renderHook(() => useSignUp(), { wrapper });
    result.current.mutate({ email: 'new-owner@clearline.dev', password: 'Correct-Horse-1!ab' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(SignUpError);
  });
});
