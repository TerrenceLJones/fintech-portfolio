import { Navigate, Outlet, useLocation } from 'react-router';
import type { OnboardingOverallStatus } from '@fintech-portfolio/contracts';
import { useOnboardingStatus } from '@fintech-portfolio/data-access-onboarding';
import { EmptyState } from '@fintech-portfolio/ui';
import { stepPath } from '../pages/onboarding/wizard-steps';

const TERMINAL_STATUSES: OnboardingOverallStatus[] = [
  'approved',
  'under_review',
  'documents_blocked',
];

/**
 * Route guard for the `/onboarding/:step` wizard routes — mirrors RequireAuth's shape. Renders the
 * matched step only when the URL agrees with the server's `currentStep`; any mismatch redirects to
 * the canonical step path, which is what makes both "resume at the right step on load" (US-CW-004
 * AC-01/AC-02) and "resume from last completed step after a 30-minute timeout" (AC-06) work with
 * the same mechanism — the server has already applied the timeout rollback by the time this reads
 * `currentStep`. A terminal status (approved/under_review/documents_blocked) redirects to the
 * shared status page instead of any wizard step.
 */
export function OnboardingProgressBoundary() {
  const location = useLocation();
  const status = useOnboardingStatus();

  if (status.isPending) {
    return null;
  }

  if (status.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon="triangle-alert"
          title="Connection problem"
          body="Couldn't reach the server to check your onboarding progress."
          action="Try again"
          onAction={() => status.refetch()}
        />
      </div>
    );
  }

  if (TERMINAL_STATUSES.includes(status.data.status)) {
    return <Navigate to="/onboarding/status" replace />;
  }

  const canonicalPath = stepPath(status.data.currentStep);
  if (location.pathname !== canonicalPath) {
    return (
      <Navigate
        to={canonicalPath}
        replace
        state={{ sessionTimedOut: status.data.sessionTimedOut }}
      />
    );
  }

  return <Outlet />;
}
