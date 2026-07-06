import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useCompleteStep } from './use-complete-step';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useCompleteStep', () => {
  afterEach(() => clearAccessToken());

  it('posts to the step-specific complete endpoint', async () => {
    setAccessToken('access_valid');
    let requestedPath = '';
    server.use(
      http.post('*/api/onboarding/steps/:step/complete', ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHook(() => useCompleteStep(), { wrapper });
    result.current.mutate('owners');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedPath).toBe('/api/onboarding/steps/owners/complete');
  });

  it('invalidates the cached onboarding status on success — this is what lets OnboardingProgressBoundary see the advanced step immediately after navigating', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/onboarding/steps/:step/complete', () => HttpResponse.json({})));
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { currentStep: 'business' });

    const { result } = renderHook(() => useCompleteStep(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate('business');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});
