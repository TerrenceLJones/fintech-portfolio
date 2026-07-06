import { useSession } from '@fintech-portfolio/data-access-auth';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * Stub redirect target for US-CW-001's post-login navigation — the real spend dashboard is
 * separate epic scope. Calls useSession() as this app's first authenticated request, giving
 * US-CW-002 AC-01's silent-refresh interceptor a real call site to exercise rather than only
 * unit-level coverage — and, via React Query's default refetch-on-window-focus, the request
 * whose next call surfaces AC-06's cross-device revocation.
 */
export function DashboardPage() {
  usePageTitle('Spend Dashboard');
  const session = useSession();

  return (
    <div>
      <div>Welcome back.</div>
      {session.data && <div>Signed in as {session.data.email}</div>}
    </div>
  );
}
