/** Cache key for the New Payment form's context (source balance/limit + recipients). */
export const PAYMENTS_CONTEXT_QUERY_KEY = ['payments', 'context'] as const;

/** Cache key for a single payment intent — so the status page and any invalidation can't drift apart. */
export function paymentIntentQueryKey(intentId: string): readonly [string, string, string] {
  return ['payments', 'intent', intentId];
}

/** Cache key for an FX quote, parameterized by the pair and USD amount being converted. */
export function exchangeRateQueryKey(
  fromCurrency: string,
  toCurrency: string,
  amountMinorUnits: number,
): readonly [string, string, string, string, number] {
  return ['payments', 'fx', fromCurrency, toCurrency, amountMinorUnits];
}
