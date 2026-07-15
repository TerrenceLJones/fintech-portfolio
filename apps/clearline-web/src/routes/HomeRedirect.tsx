import { Navigate } from 'react-router';
import { useAuthorization } from '@clearline/data-access-auth';
import { homePathForPermissions } from '../rbac/nav-items';

/**
 * The authenticated index route ("/"). Sends the user to their role-appropriate home (US-CW-001):
 * approvers to their approval queue, everyone else to My Expenses. Waits for the session-derived
 * permissions to load before redirecting so it never bounces an approver to the wrong page for a
 * frame. Replaces history so Back doesn't land the user on this transient redirector.
 */
export function HomeRedirect() {
  const { can, isLoading } = useAuthorization();
  if (isLoading) return null;
  return <Navigate to={homePathForPermissions(can)} replace />;
}
