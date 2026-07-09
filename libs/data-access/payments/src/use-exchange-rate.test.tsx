import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { useExchangeRate } from './use-exchange-rate';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useExchangeRate', () => {
  it('returns the converted amount and rate for the requested pair', async () => {
    setAccessToken('access_valid');
    let seenUrl = '';
    server.use(
      http.get('*/api/payments/fx', ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          rate: { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.918 },
          convertedAmount: { amountMinorUnits: 459_000, currency: 'EUR' },
        });
      }),
    );

    const { result } = renderHook(() => useExchangeRate('USD', 'EUR', 500_000, { enabled: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.convertedAmount.amountMinorUnits).toBe(459_000);
    expect(seenUrl).toContain('from=USD');
    expect(seenUrl).toContain('to=EUR');
    expect(seenUrl).toContain('amount=500000');
  });

  it('does not fetch while disabled', async () => {
    setAccessToken('access_valid');
    const { result } = renderHook(() => useExchangeRate('USD', 'EUR', 0, { enabled: false }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
