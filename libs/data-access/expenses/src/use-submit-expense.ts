import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateExpenseRequest,
  ExpenseErrorCode,
  ExpenseErrorResponse,
  ExpenseResponse,
} from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { EXPENSES_QUERY_KEY } from './expenses-query-key';

/**
 * A server-side policy rejection of a submission (422), carrying the exact code the form maps to the
 * design's inline copy — invalid amount, missing category, or a receipt required over $75 (US-CW-011
 * AC-02). Distinct from a network error so the form re-surfaces the specific field guidance instead of
 * a generic failure. The advisory category-limit warning is never a rejection, so it never lands here.
 */
export class ExpenseValidationError extends Error {
  readonly code: ExpenseErrorCode;

  constructor(code: ExpenseErrorCode) {
    super(`expense_invalid: ${code}`);
    this.name = 'ExpenseValidationError';
    this.code = code;
  }
}

async function postExpense(request: CreateExpenseRequest): Promise<ExpenseResponse> {
  const response = await authenticatedFetch('/api/expenses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status === 422) {
    const body = (await response.json()) as ExpenseErrorResponse;
    throw new ExpenseValidationError(body.error);
  }
  if (!response.ok) {
    throw new Error('expense_submit_failed');
  }
  return response.json();
}

/**
 * Submits an expense. The server independently re-runs the same policy gate the form uses (US-CW-011
 * technical notes); a 422 surfaces as a typed ExpenseValidationError so the form can re-block the
 * exact field, never a silent failure. On success the My Expenses list is invalidated so the new
 * expense appears.
 */
export function useSubmitExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY }),
  });
}
