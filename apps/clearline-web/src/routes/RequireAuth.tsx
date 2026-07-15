import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState } from '@clearline/ui';
import { getAccessToken, useRefreshToken } from '@clearline/data-access-auth';

/**
 * Route guard for pages that require an authenticated session — mount as the element of a parent
 * `<Route>` and nest protected routes under it so they render via `<Outlet/>` only once a token is
 * present, otherwise redirecting to /login with the attempted path preserved as `?next=`.
 *
 * When no in-memory access token is present (e.g. a hard reload — access tokens are deliberately
 * never persisted, see access-token-store), this attempts one silent refresh against the
 * httpOnly refresh-token cookie before giving up and redirecting (US-CW-002 AC-01) — so a reload
 * during a still-valid session resumes it instead of bouncing to /login. Renders nothing while
 * that check is in flight rather than redirecting optimistically.
 *
 * A 'network-error' outcome is deliberately NOT treated the same as 'no-session': a dropped
 * connection on reload isn't evidence the session is gone, so it doesn't force a sign-out — it
 * offers a manual retry instead, the same way authenticatedFetch leaves an existing session alone
 * on a network failure rather than forcing a logout for what might just be a flaky connection.
 *
 * KNOWN DEMO-MODE CAVEAT (mock backend only): in the browser the reload-resume above does NOT work,
 * so a hard reload of an authenticated session bounces here to /login. This is not a client bug —
 * MSW's Service Worker can't set the httpOnly refresh-token cookie (`Set-Cookie` is a forbidden
 * response header on a SW's synthetic response; see mock-backend browser.ts), so the silent refresh
 * on boot sends no cookie and the server returns 401. Against a real backend the cookie round-trips
 * and the session resumes. A side effect: the reload leaves a still-active refresh-token family on
 * the server, so the *next* login trips the multi-device "New sign-in detected" notice in LoginPage
 * even in the same browser — same root cause, also expected in the demo.
 */
export function RequireAuth() {
  const location = useLocation();
  const hasToken = getAccessToken() != null;
  const refresh = useRefreshToken(!hasToken);

  if (hasToken || refresh.data === 'success') {
    return <Outlet />;
  }

  if (refresh.data === 'network-error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon="triangle-alert"
          title="Connection problem"
          body="Couldn't reach the server to verify your session."
          action="Try again"
          onAction={() => refresh.refetch()}
        />
      </div>
    );
  }

  if (refresh.isPending) {
    return null;
  }

  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}
