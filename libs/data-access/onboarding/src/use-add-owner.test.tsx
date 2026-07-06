import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useAddOwner } from './use-add-owner';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

describe('useAddOwner', () => {
  afterEach(() => clearAccessToken());

  it('resolves with the created owner record', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/owners', () =>
        HttpResponse.json({
          owner: {
            id: 'owner_1',
            fullName: 'Dara Reyes',
            ownershipPercent: 60,
            requiresKyc: true,
            ssnItinLast4: '4417',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useAddOwner(), { wrapper });
    result.current.mutate({ fullName: 'Dara Reyes', ownershipPercent: 60, ssnItin: '123-45-4417' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.owner).toMatchObject({ fullName: 'Dara Reyes', requiresKyc: true });
  });

  it('invalidates the cached onboarding status on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/owners', () =>
        HttpResponse.json({
          owner: { id: 'owner_1', fullName: 'Dara Reyes', ownershipPercent: 60, requiresKyc: true },
        }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { currentStep: 'owners' });

    const { result } = renderHook(() => useAddOwner(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({ fullName: 'Dara Reyes', ownershipPercent: 60 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});
