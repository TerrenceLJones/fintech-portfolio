import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { useSession } from '@clearline/data-access-auth';
import { buildDashboardBeacon } from './DashboardPage.beacon';

/**
 * Stub landing target for US-CW-001's post-login navigation — the "My Expenses" section at "/", so its
 * heading falls through to that nav label via AppChrome (US-CW-006). The real Spend Analytics Dashboard
 * (US-CW-015) is a separate route in a later epic, not this page. Calls useSession() as this app's first
 * authenticated request, giving US-CW-002 AC-01's silent-refresh interceptor a real call site to
 * exercise rather than only unit-level coverage — and, via React Query's default refetch-on-window-focus,
 * the request whose next call surfaces AC-06's cross-device revocation.
 */
export function DashboardPage() {
  const session = useSession();

  const queryClient = useQueryClient();
  useDemoBeacon(useMemo(() => buildDashboardBeacon(queryClient), [queryClient]));

  return (
    <div>
      <div>Welcome back.</div>
      {session.data && <div>Signed in as {session.data.email}</div>}
    </div>
  );
}
