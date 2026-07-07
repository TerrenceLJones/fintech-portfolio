import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useSubmitReview } from './use-submit-review';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useSubmitReview', () => {
  afterEach(() => clearAccessToken());

  it('resolves with the approved outcome', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/review/submit', () => HttpResponse.json({ outcome: 'approved' })),
    );

    const { result } = renderHook(() => useSubmitReview(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'approved' });
  });

  it('resolves with the under_review outcome', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/review/submit', () =>
        HttpResponse.json({ outcome: 'under_review' }),
      ),
    );

    const { result } = renderHook(() => useSubmitReview(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'under_review' });
  });

  // Unlike the other onboarding mutations, this hook deliberately does NOT invalidate the status
  // query itself — the caller invalidates only after navigating off the guarded wizard route, so the
  // wizard guard can't race the navigation to a terminal status. See useSubmitReview's doc comment.
  it('does not invalidate the cached onboarding status on its own', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/review/submit', () => HttpResponse.json({ outcome: 'approved' })),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { status: 'in_progress' });

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(false);
  });
});
