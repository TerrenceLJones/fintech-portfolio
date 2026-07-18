import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { postInvite } from './fetch-team';

/**
 * Invite a teammate by work email with a role (US-CW-031 AC-01). The response is enumeration-safe, so
 * success says nothing about whether that email already had an account. On success the roster subtree
 * is invalidated so the new pending invite appears immediately.
 */
export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY }),
  });
}
