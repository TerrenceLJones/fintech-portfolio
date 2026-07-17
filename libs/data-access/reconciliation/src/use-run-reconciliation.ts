import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { RECONCILIATION_QUERY_KEY } from './reconciliation-query-keys';

async function postRun(): Promise<void> {
  const response = await authenticatedFetch('/api/reconciliation/run', { method: 'POST' });
  if (!response.ok) {
    throw new Error('reconciliation_run_failed');
  }
}

/**
 * The "Run again" control — re-runs the reconciliation job on demand, then invalidates the whole
 * reconciliation subtree so the summary, queue and matched list all refetch against the fresh run.
 */
export function useRunReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postRun,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RECONCILIATION_QUERY_KEY });
    },
  });
}
