import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TransferOwnershipRequest } from '@clearline/contracts';
import { TEAM_QUERY_KEY } from './team-query-keys';
import { postOwnerTransfer } from './fetch-team';

/**
 * Transfer the Owner role to another current member (US-CW-043). On success both the team roster and
 * the caller's own session are invalidated so the outgoing Owner immediately loses, and the new Owner
 * gains, Owner-gated surfaces — the mid-session role change rides the session without a forced re-login
 * (US-CW-006 AC-05 / AC-06). Failures surface as a typed TransferOwnershipError naming the reason (AC-07).
 */
export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TransferOwnershipRequest) => postOwnerTransfer(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}
