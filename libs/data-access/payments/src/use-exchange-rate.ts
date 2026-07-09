import { useQuery } from '@tanstack/react-query';
import type { ExchangeRateResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { exchangeRateQueryKey } from './payments-query-key';

async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  amountMinorUnits: number,
): Promise<ExchangeRateResponse> {
  const params = new URLSearchParams({
    from: fromCurrency,
    to: toCurrency,
    amount: String(amountMinorUnits),
  });
  const response = await authenticatedFetch(`/api/payments/fx?${params.toString()}`);
  if (!response.ok) {
    throw new Error('exchange_rate_failed');
  }
  return response.json();
}

/**
 * A live cross-currency quote for a recipient whose account isn't USD (US-CW-008 AC-06). The New
 * Payment form shows the converted amount and rate, and blocks confirmation until the user has seen
 * them. Only enabled once a converting amount and target currency are known.
 */
export function useExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  amountMinorUnits: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: exchangeRateQueryKey(fromCurrency, toCurrency, amountMinorUnits),
    queryFn: () => getExchangeRate(fromCurrency, toCurrency, amountMinorUnits),
    retry: false,
    enabled: options.enabled,
  });
}
