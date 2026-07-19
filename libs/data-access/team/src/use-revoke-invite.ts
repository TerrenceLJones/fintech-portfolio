import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { deleteInvite } from './fetch-team';

/**
 * Revoke a pending invite (US-CW-031 AC-10). The outstanding link can no longer be accepted; on
 * success the roster subtree is invalidated so the invite drops off the list immediately.
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => deleteInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY }),
  });
}
