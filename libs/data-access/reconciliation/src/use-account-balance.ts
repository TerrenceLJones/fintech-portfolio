import { useQuery } from '@tanstack/react-query';
import type { ReconciliationBalanceResponse } from '@clearline/contracts';
import { reconciliationKeys } from './reconciliation-query-keys';
import { fetchReconciliation } from './fetch-reconciliation';

/**
 * The reconciliation account's balance, guarded by the internal-integrity check. The response is a
 * discriminated status — an `ok` balance or an `integrity_failure` carrying only a support reference —
 * so the page can render the Fatal-tier withheld-balance state instead of a possibly-wrong number
 * (US-CW-016 AC-04). A 200 either way: withholding the balance is a paused display, not an HTTP error.
 */
export function useAccountBalance() {
  return useQuery({
    queryKey: reconciliationKeys.balance(),
    queryFn: () => fetchReconciliation<ReconciliationBalanceResponse>('balance'),
    retry: false,
  });
}
