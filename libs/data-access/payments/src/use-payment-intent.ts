import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { PaymentIntentResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { paymentIntentQueryKey } from './payments-query-key';

/** React Query's refetchInterval type for this query — a number, false, or a function of the query. */
type PaymentIntentRefetchInterval = UseQueryOptions<PaymentIntentResponse>['refetchInterval'];

async function getPaymentIntent(intentId: string): Promise<PaymentIntentResponse> {
  const response = await authenticatedFetch(`/api/payments/${intentId}`);
  if (!response.ok) {
    throw new Error('payment_intent_failed');
  }
  return response.json();
}

export interface UsePaymentIntentOptions {
  enabled?: boolean;
  /**
   * Polling cadence for a still-settling payment (US-CW-007 AC-03 / US-CW-009): the status page passes
   * a function that awaits the definitive PaymentIntent status while non-terminal, and `false` once it
   * settles. Accepts React Query's number | false | ((query) => number | false) forms.
   */
  refetchInterval?: PaymentIntentRefetchInterval;
}

/**
 * A single payment intent for the transaction-detail / status view. Returns the raw wire intent — the
 * caller normalizes its status via @clearline/domain-payments (an unrecognized code degrades to a
 * neutral "Processing", US-CW-009 AC-03).
 */
export function usePaymentIntent(intentId: string, options: UsePaymentIntentOptions = {}) {
  return useQuery({
    queryKey: paymentIntentQueryKey(intentId),
    queryFn: () => getPaymentIntent(intentId),
    retry: false,
    enabled: options.enabled,
    refetchInterval: options.refetchInterval ?? false,
  });
}
