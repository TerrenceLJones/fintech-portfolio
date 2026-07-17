import { useQuery } from '@tanstack/react-query';
import type { ReconciliationSummaryResponse } from '@clearline/contracts';
import { reconciliationKeys } from './reconciliation-query-keys';
import { fetchReconciliation } from './fetch-reconciliation';

/** The reconciliation run's headline stats — auto-matched, exceptions, match rate, last run (US-CW-016 AC-01). */
export function useReconciliationSummary() {
  return useQuery({
    queryKey: reconciliationKeys.summary(),
    queryFn: () => fetchReconciliation<ReconciliationSummaryResponse>('summary'),
    retry: false,
  });
}
