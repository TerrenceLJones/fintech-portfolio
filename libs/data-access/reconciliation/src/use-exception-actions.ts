import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { RECONCILIATION_QUERY_KEY } from './reconciliation-query-keys';

/** POST a no-body action against one exception, throwing on any non-2xx. */
async function postExceptionAction(exceptionId: string, action: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/reconciliation/exceptions/${exceptionId}/${action}`,
    { method: 'POST' },
  );
  if (!response.ok) {
    throw new Error(`reconciliation_${action}_failed`);
  }
}

/** Every queue mutation invalidates the whole reconciliation subtree so counts + lists refetch together. */
function useExceptionAction(action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exceptionId: string) => postExceptionAction(exceptionId, action),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RECONCILIATION_QUERY_KEY });
    },
  });
}

/** Confirm a suggested fuzzy match → a permanent match, dropping it from the queue (US-CW-016 AC-03). */
export function useConfirmMatch() {
  return useExceptionAction('confirm');
}

/** Reject a suggestion → it stays in the queue as an unmatched line rather than being discarded (AC-03). */
export function useRejectSuggestion() {
  return useExceptionAction('reject');
}

/** Dismiss an exception out of the queue. */
export function useDismissException() {
  return useExceptionAction('dismiss');
}
