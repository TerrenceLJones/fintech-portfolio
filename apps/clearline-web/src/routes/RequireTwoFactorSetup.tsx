import { Navigate, Outlet } from 'react-router';
import { useSession } from '@clearline/data-access-auth';

/**
 * Route guard enforcing org-wide mandatory 2FA (US-CW-040 AC-04). When the org requires 2FA and this
 * member hasn't enrolled, their session carries `twoFactorSetupRequired` (stamped at login, so a member
 * already mid-session is never forced — edge case). Such a member is redirected into the setup gate
 * before any Clearline page renders. The flag clears the instant they finish setup, releasing them.
 * Mount as the element of a parent `<Route>` wrapping the authenticated app subtree.
 */
export function RequireTwoFactorSetup() {
  const session = useSession();

  // Until the session resolves, render nothing rather than flashing the app for a member who may be
  // about to be gated. A session-ending error is already handled downstream by SessionActivityBoundary.
  if (session.isPending) return null;

  if (session.data?.twoFactorSetupRequired) {
    return <Navigate to="/two-factor-required" replace />;
  }

  return <Outlet />;
}
