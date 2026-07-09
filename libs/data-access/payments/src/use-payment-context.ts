import { useQuery } from '@tanstack/react-query';
import type { PaymentContextResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { PAYMENTS_CONTEXT_QUERY_KEY } from './payments-query-key';

/** Thrown when the server rejects the context read with 403 — the redundant server check behind the route guard. */
export class PaymentsForbiddenError extends Error {
  constructor() {
    super('payments_forbidden');
    this.name = 'PaymentsForbiddenError';
  }
}

async function getPaymentContext(): Promise<PaymentContextResponse> {
  const response = await authenticatedFetch('/api/payments/context');
  if (response.status === 403) {
    throw new PaymentsForbiddenError();
  }
  if (!response.ok) {
    throw new Error('payment_context_failed');
  }
  return response.json();
}

/**
 * The source account (derived, read-only available balance + daily limit/spend) and verified recipients
 * the New Payment form validates against before any submit (US-CW-008). A server 403 surfaces as
 * PaymentsForbiddenError so a mid-session downgrade degrades to access-denied rather than a generic error.
 */
export function usePaymentContext(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: PAYMENTS_CONTEXT_QUERY_KEY,
    queryFn: getPaymentContext,
    retry: false,
    enabled: options.enabled,
  });
}
