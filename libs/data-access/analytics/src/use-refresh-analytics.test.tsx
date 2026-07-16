import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ANALYTICS_QUERY_KEY } from './analytics-query-keys';
import { useRefreshAnalytics } from './use-refresh-analytics';

const server = registerMswServer();
afterEach(() => clearAccessToken());

describe('useRefreshAnalytics', () => {
  it('POSTs the refresh and invalidates the whole analytics subtree so every section refetches (AC-06)', async () => {
    setAccessToken('access_valid');
    let posted = false;
    server.use(
      http.post('*/api/analytics/refresh', () => {
        posted = true;
        return HttpResponse.json({ summary: {} });
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRefreshAnalytics(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(posted).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ANALYTICS_QUERY_KEY });
  });

  it('still invalidates (so sections refetch) even when the refresh POST fails', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/analytics/refresh', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRefreshAnalytics(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ANALYTICS_QUERY_KEY });
  });
});
