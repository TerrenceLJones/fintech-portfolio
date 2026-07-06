import { useQuery } from '@tanstack/react-query';
import { refreshAccessToken } from './api-client';

/**
 * Modeled as a `useQuery`, not a `useMutation` — same reasoning as useVerifyEmail: this fires once
 * as a mount-time side effect (exchanging the refresh-token cookie for a fresh access token), and
 * query-key-based dedup means React's dev-mode double-invoke of effects can't fire it twice or
 * race two rotations against each other. Resolves a `RefreshOutcome` rather than throwing; a
 * failed attempt is not an app error, just "no session to resume" (or "couldn't tell") — see
 * RequireAuth, the caller this exists for (US-CW-002 AC-01), which treats 'no-session' and
 * 'network-error' differently. Pass `enabled: false` once the caller already knows there's
 * nothing to check (e.g. an access token is already in memory).
 */
export function useRefreshToken(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'silent-refresh'],
    queryFn: refreshAccessToken,
    enabled,
    retry: false,
    gcTime: 0,
  });
}
