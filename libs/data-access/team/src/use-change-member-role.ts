import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChangeMemberRoleRequest } from '@clearline/contracts';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { patchMemberRole } from './fetch-team';

/**
 * Change an existing member's approval tier (US-CW-031 AC-04). Takes effect on that member's next
 * request; on success the roster is invalidated so their new role shows at once.
 */
export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, request }: { memberId: string; request: ChangeMemberRoleRequest }) =>
      patchMemberRole(memberId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY }),
  });
}
