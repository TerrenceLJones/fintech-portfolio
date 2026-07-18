import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { deleteMember } from './fetch-team';

/**
 * Remove a member from the organization (US-CW-031 AC-05). Their session is invalidated on their next
 * request; on success the roster is invalidated so they drop off the list immediately.
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => deleteMember(memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY }),
  });
}
