import { useQuery } from '@tanstack/react-query';
import type { ReconciliationMatchedResponse } from '@clearline/contracts';
import { reconciliationKeys } from './reconciliation-query-keys';
import { fetchReconciliation } from './fetch-reconciliation';

/** The reconciled matches — the "Matched" tab's list of bank lines tied to ledger entries (AC-01). */
export function useMatched() {
  return useQuery({
    queryKey: reconciliationKeys.matched(),
    queryFn: () => fetchReconciliation<ReconciliationMatchedResponse>('matched'),
    retry: false,
  });
}
