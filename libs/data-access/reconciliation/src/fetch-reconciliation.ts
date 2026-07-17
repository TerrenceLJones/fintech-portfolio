import { authenticatedFetch } from '@clearline/data-access-auth';
import { ReconciliationForbiddenError } from './reconciliation-forbidden-error';

/**
 * Fetch one reconciliation panel. A 403 becomes ReconciliationForbiddenError (access-denied); any other
 * non-2xx throws so React Query surfaces the panel's own error state — which the page renders as the
 * scoped "This section couldn't load. Retry." card, isolated from the other panels.
 */
export async function fetchReconciliation<T>(panel: string): Promise<T> {
  const response = await authenticatedFetch(`/api/reconciliation/${panel}`);
  if (response.status === 403) {
    throw new ReconciliationForbiddenError();
  }
  if (!response.ok) {
    throw new Error(`reconciliation_${panel}_failed`);
  }
  return response.json() as Promise<T>;
}
