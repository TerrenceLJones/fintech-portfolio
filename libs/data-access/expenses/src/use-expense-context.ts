import { useQuery } from '@tanstack/react-query';
import type { ExpenseContextResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { EXPENSE_CONTEXT_QUERY_KEY } from './expenses-query-key';

/** Thrown when the server rejects the context read with 403 — the redundant server check behind the page guard. */
export class ExpenseContextForbiddenError extends Error {
  constructor() {
    super('expense_context_forbidden');
    this.name = 'ExpenseContextForbiddenError';
  }
}

async function getExpenseContext(): Promise<ExpenseContextResponse> {
  const response = await authenticatedFetch('/api/expenses/context');
  if (response.status === 403) {
    throw new ExpenseContextForbiddenError();
  }
  if (!response.ok) {
    throw new Error('expense_context_failed');
  }
  return response.json();
}

/**
 * The categories and receipt-required threshold the New Expense form needs to validate an expense
 * before submitting (US-CW-011). A server 403 surfaces as ExpenseContextForbiddenError so a bypassed
 * guard degrades to access-denied rather than a generic error.
 */
export function useExpenseContext(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: EXPENSE_CONTEXT_QUERY_KEY,
    queryFn: getExpenseContext,
    retry: false,
    enabled: options.enabled,
  });
}
