import { useQuery } from '@tanstack/react-query';
import type { ReconciliationExceptionsResponse } from '@clearline/contracts';
import { reconciliationKeys } from './reconciliation-query-keys';
import { fetchReconciliation } from './fetch-reconciliation';

/** The exceptions queue — unmatched, suggested and ambiguous lines the run couldn't auto-match (AC-02/AC-03). */
export function useExceptions() {
  return useQuery({
    queryKey: reconciliationKeys.exceptions(),
    queryFn: () => fetchReconciliation<ReconciliationExceptionsResponse>('exceptions'),
    retry: false,
  });
}
