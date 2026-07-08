import { Navigate, Outlet, useLocation } from 'react-router';
import { getAccessToken } from '@clearline/data-access-auth';
import { useOnboardingStatus } from '@clearline/data-access-onboarding';
import { Alert, EmptyState } from '@clearline/ui';
import { onboardingDestination } from '../pages/onboarding/onboarding-routing';
import { stepPath } from '../pages/onboarding/wizard-steps';

/**
 * Route guard for the `/onboarding/:step` wizard routes — mirrors RequireAuth's shape. Renders the
 * matched step only when the URL agrees with the server's `currentStep`; any mismatch redirects to
 * the canonical step path, which is what makes both "resume at the right step on load" (US-CW-004
 * AC-01/AC-02) and "resume from last completed step after a 30-minute timeout" (AC-06) work with
 * the same mechanism — the server has already applied the timeout rollback by the time this reads
 * `currentStep`. Once the wizard is behind the user, the shared onboardingDestination policy takes
 * over: an approved user is sent to the dashboard (AC-10) and an under_review / documents_blocked
 * user to the status page (AC-11), so a completed user can never re-enter an editable step.
 */
export function OnboardingProgressBoundary() {
  const location = useLocation();
  const status = useOnboardingStatus();

  if (status.isPending) {
    return null;
  }

  if (status.isError) {
    // A session-ending 401 already cleared the access token and fired the /login redirect, so don't
    // flash a "couldn't reach the server" retry over that — it's only for a still-authenticated
    // failure (server genuinely unreachable). Same distinction RequireAuth draws.
    if (getAccessToken() == null) {
      return null;
    }
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

  const destination = onboardingDestination(status.data.status);
  if (destination === 'app') {
    return <Navigate to="/" replace />;
  }
  if (destination === 'status') {
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

  const sessionTimedOut = (location.state as { sessionTimedOut?: boolean } | null)?.sessionTimedOut;

  return (
    <>
      {sessionTimedOut && (
        <div className="mx-auto max-w-md pt-6">
          <Alert
            tone="warning"
            title="Your verification session timed out. Let's start again from where you left off."
          />
        </div>
      )}
      <Outlet />
    </>
  );
}
