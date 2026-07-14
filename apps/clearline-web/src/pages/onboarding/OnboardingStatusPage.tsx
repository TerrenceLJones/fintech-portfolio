import { Navigate, useNavigate } from 'react-router';
import { useOnboardingStatus } from '@clearline/data-access-onboarding';
import { EmptyState, Text } from '@clearline/ui';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { onboardingDestination } from './onboarding-routing';
import { stepPath } from './wizard-steps';
import { onboardingStatusBeacon } from './onboarding.beacon';

/**
 * Terminal onboarding screens share one shape (icon + title + body + single CTA), so they're one
 * status-driven page rather than four near-identical ones — see design spec section 2.3.
 * 'under_review' deliberately never renders the compliance-screening reason itself (US-CW-005
 * AC-05) — the server never sends it across the API boundary in the first place (see
 * OnboardingService.submitReview), so there's nothing here that could leak it even by accident.
 */
export function OnboardingStatusPage() {
  useDemoBeacon(onboardingStatusBeacon);
  const navigate = useNavigate();
  const status = useOnboardingStatus();

  if (!status.data) return null;

  // A user who hasn't submitted yet has no terminal status to show — send them back into the
  // wizard at their current step rather than rendering an empty screen (US-CW-004 AC-12). But only
  // once a fetch has settled: right after a review submission the cached status is still the stale
  // 'in_progress' while the invalidated query refetches the terminal status, and bouncing to the
  // wizard on that stale value would skip the approval/under-review screen (AC-08) entirely.
  if (onboardingDestination(status.data.status) === 'wizard') {
    if (status.isFetching) return null;
    return <Navigate to={stepPath(status.data.currentStep)} replace />;
  }

  if (status.data.status === 'approved') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon="check"
          title="Your account is approved"
          body="Full transacting capability is unlocked — you can now make payments and issue cards."
          action="Go to dashboard"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  if (status.data.status === 'under_review') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon="clock"
          title="Your application is under review"
          body="We'll email you within 2–3 business days. No further action is needed from you right now."
          action="Go to dashboard"
          onAction={() => navigate('/')}
        />
      </div>
    );
  }

  if (status.data.status === 'documents_blocked') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon="triangle-alert"
          title="We couldn't verify your documents"
          body="Contact support to continue. We've paused further upload attempts on this application."
          action="Contact support"
          onAction={() => {}}
        />
        {status.data.supportReferenceId ? (
          <Text as="div" size="mono" tone="faint" className="mt-3 text-center">
            Support reference {status.data.supportReferenceId}
          </Text>
        ) : null}
      </div>
    );
  }

  return null;
}
