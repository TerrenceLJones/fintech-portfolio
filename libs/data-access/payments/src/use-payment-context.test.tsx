import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { PaymentsForbiddenError, usePaymentContext } from './use-payment-context';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('usePaymentContext', () => {
  it('returns the source account and recipients on a 200', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/payments/context', () =>
        HttpResponse.json({
          source: {
            id: 'acct_operating',
            name: 'Operating',
            maskedAccount: '••4021',
            currency: 'USD',
            availableBalance: { amountMinorUnits: 4_821_000, currency: 'USD' },
            dailyLimit: { amountMinorUnits: 2_000_000, currency: 'USD' },
            dailySpent: { amountMinorUnits: 0, currency: 'USD' },
          },
          recipients: [
            {
              id: 'rec_acme',
              name: 'Acme Corp',
              maskedAccount: '••4188',
              method: 'ach',
              currency: 'USD',
              status: 'active',
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => usePaymentContext(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.source.availableBalance.amountMinorUnits).toBe(4_821_000);
    expect(result.current.data?.recipients[0]?.id).toBe('rec_acme');
  });

  it('surfaces a 403 as PaymentsForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/payments/context', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => usePaymentContext(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PaymentsForbiddenError);
  });
});
