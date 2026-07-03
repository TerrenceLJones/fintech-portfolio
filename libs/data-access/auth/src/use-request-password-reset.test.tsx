import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useRequestPasswordReset } from './use-request-password-reset';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useRequestPasswordReset', () => {
  it('resolves on a 200 response', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.json({})));

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('throws on a network failure', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.error()));

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper });
    result.current.mutate({ email: 'demo@clearline.dev' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
