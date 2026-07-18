import { useQuery } from '@tanstack/react-query';
import type { InviteDetailsResponse } from '@clearline/contracts';
import { teamKeys } from './team-query-keys';

/** Public — the invitee has no session yet. Resolves the invite's validity + who/what it grants. */
async function getInviteDetails(token: string): Promise<InviteDetailsResponse> {
  const response = await fetch(`/api/team/invites/${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error('invite_details_failed');
  }
  return response.json() as Promise<InviteDetailsResponse>;
}

/**
 * What the invite-acceptance page shows before a password is set (Design §18.3) — valid, expired, or
 * invalid. Disabled until a token is present. `gcTime: 0` so a consumed token can't resurface a stale
 * "valid" result on a second visit, matching useVerifyEmail's reasoning.
 */
export function useInviteDetails(token: string | null) {
  return useQuery({
    queryKey: teamKeys.invite(token ?? ''),
    queryFn: () => getInviteDetails(token!),
    enabled: token != null && token.length > 0,
    retry: false,
    gcTime: 0,
  });
}
