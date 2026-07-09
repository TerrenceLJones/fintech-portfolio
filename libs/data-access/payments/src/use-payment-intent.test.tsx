import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { usePaymentIntent } from './use-payment-intent';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('usePaymentIntent', () => {
  it('fetches a single intent by id', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/payments/:id', ({ params }) =>
        HttpResponse.json({
          intent: {
            id: String(params.id),
            status: 'pending_review',
            amount: { amountMinorUnits: 500_000, currency: 'USD' },
            recipientName: 'Shadow Holdings',
            recipientMasked: '••9004',
            method: 'wire',
            createdDate: '2026-07-08T00:00:00.000Z',
          },
        }),
      ),
    );

    const { result } = renderHook(() => usePaymentIntent('pi_1', { enabled: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.intent.status).toBe('pending_review');
  });
});
