import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  RevokeOtherSessionsResponse,
  RevokeSessionResponse,
  SessionListResponse,
} from '@clearline/contracts';
import { securityKeys } from './security-query-keys';

/** The caller's active sessions, most-recently-active first (AC-08). */
export function useSessions() {
  return useQuery({
    queryKey: securityKeys.sessions,
    queryFn: async (): Promise<SessionListResponse> => {
      const response = await authenticatedFetch('/api/security/sessions');
      if (!response.ok) throw new Error('sessions_fetch_failed');
      return response.json();
    },
  });
}

/** Sign out one other device (AC-09). Refreshes the session list. */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string): Promise<RevokeSessionResponse> => {
      const response = await authenticatedFetch(
        `/api/security/sessions/${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('session_revoke_failed');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: securityKeys.sessions }),
  });
}

/** Sign out every device except the current one (AC-09). Refreshes the session list. */
export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RevokeOtherSessionsResponse> => {
      const response = await authenticatedFetch('/api/security/sessions/revoke-others', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('sessions_revoke_others_failed');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: securityKeys.sessions }),
  });
}
