import { describe, expect, it } from 'vitest';
import {
  PAYMENTS_CONTEXT_QUERY_KEY,
  exchangeRateQueryKey,
  paymentIntentQueryKey,
} from './payments-query-key';

describe('payments query keys', () => {
  it('uses a stable context key', () => {
    expect(PAYMENTS_CONTEXT_QUERY_KEY).toEqual(['payments', 'context']);
  });

  it('scopes an intent key by its id', () => {
    expect(paymentIntentQueryKey('pi_1')).toEqual(['payments', 'intent', 'pi_1']);
    // Distinct ids never collide.
    expect(paymentIntentQueryKey('pi_1')).not.toEqual(paymentIntentQueryKey('pi_2'));
  });

  it('scopes an FX key by pair and amount', () => {
    expect(exchangeRateQueryKey('USD', 'EUR', 500_000)).toEqual([
      'payments',
      'fx',
      'USD',
      'EUR',
      500_000,
    ]);
  });
});
