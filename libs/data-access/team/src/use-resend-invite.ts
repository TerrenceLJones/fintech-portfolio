import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { postInviteResend } from './fetch-team';

/**
 * Resend a pending invite (US-CW-031 AC-09). A fresh single-use link supersedes and invalidates the
 * old one, restarting the 7-day window. On success the roster subtree is invalidated so the refreshed
 * "invited" timestamp shows immediately.
 */
export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => postInviteResend(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY }),
  });
}
