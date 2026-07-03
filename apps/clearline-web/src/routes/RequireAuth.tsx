import { Navigate, Outlet, useLocation } from 'react-router';
import { getAccessToken } from '@fintech-portfolio/data-access-auth';

/**
 * Route guard for pages that require an authenticated session — mount as the element of a parent
 * `<Route>` and nest protected routes under it so they render via `<Outlet/>` only once a token is
 * present, otherwise redirecting to /login with the attempted path preserved as `?next=`.
 *
 * Checked against the in-memory access token only, so it catches "never logged in" and
 * "explicitly logged out" but not "the refresh-token cookie is still valid after a reload" — that
 * requires the silent-refresh-on-mount flow from US-CW-002 (Session & Token Lifecycle), not yet
 * built. Until then, a hard reload while still validly authenticated will also bounce here.
 */
export function RequireAuth() {
  const location = useLocation();

  if (!getAccessToken()) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
