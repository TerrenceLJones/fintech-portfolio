import { useQuery } from '@tanstack/react-query';
import type { SessionResponse } from '@fintech-portfolio/contracts';
import { authenticatedFetch } from './api-client';

async function getSession(): Promise<SessionResponse> {
  const response = await authenticatedFetch('/api/auth/session');
  if (!response.ok) {
    throw new Error('session_check_failed');
  }
  return response.json();
}

/**
 * Confirms the current access token is valid and returns who it belongs to. This is the
 * "authenticated API request" US-CW-002 AC-01's silent-refresh interceptor exercises, and —
 * via React Query's default refetch-on-window-focus — the request whose next call surfaces
 * AC-06's cross-device revocation without anything having to push it in real time. No retry:
 * authenticatedFetch already attempts one recovery internally, and a session-ending 401 has
 * already notified subscribeSessionEnded, so retrying here would just renotify.
 */
export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: getSession, retry: false });
}
