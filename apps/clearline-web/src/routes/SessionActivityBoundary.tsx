import { useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { InactivityWarningModal } from '@clearline/ui';
import { cutoffMsForMinutes } from '@clearline/domain-auth';
import {
  subscribeSessionEnded,
  useInactivityTimer,
  useLogout,
  useSession,
  type SessionEndedReason,
} from '@clearline/data-access-auth';

export type SessionEndReason = SessionEndedReason | 'inactivity';

/**
 * Mounted inside RequireAuth's protected subtree (US-CW-002). Owns two independent
 * session-ending signals and funnels both into the same forced-logout redirect:
 *  - subscribeSessionEnded — the api-client interceptor's verdict that no refresh could recover
 *    the session (AC-02 reuse, AC-03 refresh-token expiry, AC-06 password changed elsewhere).
 *  - useInactivityTimer — the client-side 14-minute-warning/15-minute-cutoff idle clock (AC-04),
 *    surfaced here as the warning modal (AC-05: any activity or "Stay signed in" resets it).
 * The current route is preserved as `?next=` on every forced redirect, same as RequireAuth's own.
 */
export function SessionActivityBoundary() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const session = useSession();

  const redirectToLogin = useCallback(
    (sessionEndReason: SessionEndReason) => {
      const next = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(next)}`, {
        replace: true,
        state: { sessionEndReason },
      });
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => subscribeSessionEnded(redirectToLogin), [redirectToLogin]);

  const inactivity = useInactivityTimer({
    // The org-configured idle timeout (US-CW-040 AC-05) is the single source for the cutoff; until the
    // session loads, the hook's own 15-minute default applies.
    cutoffMs: cutoffMsForMinutes(session.data?.idleTimeoutMinutes),
    onExpire: () => {
      logout.mutate();
      redirectToLogin('inactivity');
    },
  });

  return (
    <>
      <Outlet />
      <InactivityWarningModal
        open={inactivity.phase === 'warning'}
        secondsRemaining={inactivity.secondsRemaining}
        onStaySignedIn={inactivity.resetTimer}
        onSignOut={() => {
          logout.mutate();
          navigate('/login', { replace: true });
        }}
      />
    </>
  );
}
