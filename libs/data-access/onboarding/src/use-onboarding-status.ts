import { useQuery } from '@tanstack/react-query';
import type { OnboardingStatusResponse } from '@fintech-portfolio/contracts';
import { authenticatedFetch } from '@fintech-portfolio/data-access-auth';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const response = await authenticatedFetch('/api/onboarding/status');
  if (!response.ok) {
    throw new Error('onboarding_status_failed');
  }
  return response.json();
}

/**
 * The single source of truth for wizard progress — the server (OnboardingService) holds it, not
 * sessionStorage, which is what makes US-CW-004 AC-02's resume-after-closing-the-browser actually
 * work. `sessionTimedOut` on the response is true exactly once, the call where a 30-minute idle
 * gap rolled currentStep back (AC-06).
 */
export function useOnboardingStatus() {
  return useQuery({
    queryKey: ONBOARDING_STATUS_QUERY_KEY,
    queryFn: getOnboardingStatus,
    retry: false,
  });
}
