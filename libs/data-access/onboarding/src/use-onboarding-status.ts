import { useQuery } from '@tanstack/react-query';
import type { OnboardingStatusResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
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
// Long enough that rapid re-navigation across the app reads the cached status instead of firing a
// fresh authenticated request every time — which is what keeps this query out of useSession's
// session-revocation choreography (a second concurrent 401→refresh would muddy the session-end
// reason, US-CW-002 AC-06). Still far below the 30-minute onboarding-inactivity window, so a user
// returning after that idle gap refetches and the server's currentStep rollback is still observed
// (US-CW-004 AC-06). In-flight onboarding steps stay fresh regardless — every mutation invalidates
// this query, which refetches past any staleTime.
const ONBOARDING_STATUS_STALE_MS = 30_000;

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ONBOARDING_STATUS_QUERY_KEY,
    queryFn: getOnboardingStatus,
    retry: false,
    staleTime: ONBOARDING_STATUS_STALE_MS,
    // Route guards read this at mount/navigation, never on idle window focus — so don't let a focus
    // event fire an authenticated request that races useSession's deliberate cross-device-revocation
    // probe (US-CW-002 AC-01/AC-06).
    refetchOnWindowFocus: false,
  });
}
