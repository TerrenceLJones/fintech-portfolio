import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useSubmitBusinessInfo } from './use-submit-business-info';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

const business = {
  legalName: 'Northwind Labs, Inc.',
  ein: '12-3456789',
  structure: 'C-Corporation',
  addressLine1: '220 Mission St',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
};

describe('useSubmitBusinessInfo', () => {
  afterEach(() => clearAccessToken());

  it('resolves with the verified outcome on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () => HttpResponse.json({ outcome: 'verified' })),
    );

    const { result } = renderHook(() => useSubmitBusinessInfo(), { wrapper });
    result.current.mutate(business);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'verified' });
  });

  it('resolves with the ein_not_found outcome', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () => HttpResponse.json({ outcome: 'ein_not_found' })),
    );

    const { result } = renderHook(() => useSubmitBusinessInfo(), { wrapper });
    result.current.mutate(business);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'ein_not_found' });
  });

  it('invalidates the cached onboarding status on success, so a guard reading it sees fresh data', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () => HttpResponse.json({ outcome: 'verified' })),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { currentStep: 'business' });

    const { result } = renderHook(() => useSubmitBusinessInfo(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate(business);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});
