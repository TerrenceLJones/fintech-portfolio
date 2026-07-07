import { Navigate, Outlet } from 'react-router';
import { getAccessToken } from '@clearline/data-access-auth';
import { useOnboardingStatus } from '@clearline/data-access-onboarding';
import { EmptyState } from '@clearline/ui';
import { canAccessApp, onboardingDestination } from '../pages/onboarding/onboarding-routing';
import { stepPath } from '../pages/onboarding/wizard-steps';

/**
 * Route guard for the main application (dashboard and other non-onboarding pages) — mount as the
 * element of a parent `<Route>` so protected pages render via `<Outlet/>` only once the user has
 * completed onboarding far enough to belong in the app (US-CW-004 AC-09). It reads the same
 * server-authoritative onboarding status the wizard guard does, so it's correct across reloads and
 * devices without any client-side flags.
 *
 * A user who hasn't earned app access is redirected to where they belong: an in_progress user to
 * their current wizard step (which is also what lands a not-yet-onboarded user in the wizard rather
 * than a half-usable dashboard right after login), and a documents_blocked user to the status page.
 * under_review is deliberately admitted alongside approved so a pending compliance review never
 * blocks non-financial areas of the product (US-CW-005 AC-05).
 */
export function RequireOnboarded() {
  const status = useOnboardingStatus();

  if (status.isPending) {
    return null;
  }

  if (status.isError) {
    // A session-ending 401 already cleared the access token and fired the /login redirect
    // (authenticatedFetch -> notifySessionEnded -> SessionActivityBoundary). Render nothing over
    // that instead of a misleading "couldn't reach the server" retry — the retry is only for a
    // still-authenticated failure (server genuinely unreachable), mirroring RequireAuth's
    // network-error-vs-no-session split.
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

  if (canAccessApp(status.data.status)) {
    return <Outlet />;
  }

  const destination = onboardingDestination(status.data.status);
  const target =
    destination === 'wizard' ? stepPath(status.data.currentStep) : '/onboarding/status';
  return <Navigate to={target} replace />;
}
