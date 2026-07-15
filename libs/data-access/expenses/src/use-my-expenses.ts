import { useQuery } from '@tanstack/react-query';
import type { MyExpensesResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { EXPENSES_QUERY_KEY } from './expenses-query-key';

async function getMyExpenses(): Promise<MyExpensesResponse> {
  const response = await authenticatedFetch('/api/expenses');
  if (!response.ok) {
    throw new Error('my_expenses_failed');
  }
  return response.json();
}

/**
 * The current user's submitted expenses and their statuses (US-CW-011). Shares the EXPENSES_QUERY_KEY
 * cache slot with the submit invalidation, so a freshly-submitted expense appears without a manual
 * refetch.
 */
export function useMyExpenses(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: EXPENSES_QUERY_KEY,
    queryFn: getMyExpenses,
    retry: false,
    enabled: options.enabled,
  });
}
