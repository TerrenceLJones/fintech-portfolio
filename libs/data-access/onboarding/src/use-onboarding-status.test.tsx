import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { useOnboardingStatus } from './use-onboarding-status';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

describe('useOnboardingStatus', () => {
  it('resolves with the current onboarding status', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json({
          businessId: 'business_1',
          status: 'in_progress',
          currentStep: 'business',
          lastCompletedStep: null,
          business: null,
          owners: [],
          documents: [],
          documentAttemptCount: 0,
          lastActivityAt: 0,
          sessionTimedOut: false,
        }),
      ),
    );

    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ status: 'in_progress', currentStep: 'business' });
    clearAccessToken();
  });

  it('surfaces an error when the status request fails', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json({ error: 'unauthenticated' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    clearAccessToken();
  });
});
