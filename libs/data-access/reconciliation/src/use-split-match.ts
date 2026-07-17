import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatchedEntry, ReconciliationErrorResponse, SplitPortion } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { RECONCILIATION_QUERY_KEY } from './reconciliation-query-keys';
import { SplitMismatchError } from './split-mismatch-error';

export interface SplitMatchInput {
  exceptionId: string;
  portions: SplitPortion[];
}

async function postSplit({ exceptionId, portions }: SplitMatchInput): Promise<MatchedEntry> {
  const response = await authenticatedFetch(`/api/reconciliation/exceptions/${exceptionId}/split`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ portions }),
  });
  if (response.status === 422) {
    const body = (await response.json()) as ReconciliationErrorResponse;
    if (body.error === 'split_mismatch') {
      throw new SplitMismatchError(body.expected, body.provided);
    }
  }
  if (!response.ok) {
    throw new Error('reconciliation_split_failed');
  }
  const body = (await response.json()) as { matched: MatchedEntry };
  return body.matched;
}

/**
 * Commit a split match. The server re-validates that the portions sum exactly to the source amount and
 * a mismatch surfaces as a typed SplitMismatchError (US-CW-016 AC-05); on success the whole
 * reconciliation subtree is invalidated so the queue and matched list refetch together.
 */
export function useSplitMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSplit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RECONCILIATION_QUERY_KEY });
    },
  });
}
