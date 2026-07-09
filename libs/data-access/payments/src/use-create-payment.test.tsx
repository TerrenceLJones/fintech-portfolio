import { afterEach, describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import {
  PaymentTimeoutError,
  PaymentValidationError,
  useCreatePayment,
  type CreatePaymentVariables,
} from './use-create-payment';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({});

afterEach(() => clearAccessToken());

const variables: CreatePaymentVariables = {
  request: {
    recipientId: 'rec_acme',
    amount: { amountMinorUnits: 500_000, currency: 'USD' },
    method: 'ach',
  },
  idempotencyKey: '8f2a04b1-1c2d-4e3f-8a9b-1234567890c4',
};

const pendingIntent = {
  id: 'pi_1',
  status: 'pending',
  amount: { amountMinorUnits: 500_000, currency: 'USD' },
  recipientName: 'Acme Corp',
  recipientMasked: '••4188',
  method: 'ach',
  createdDate: '2026-07-08T00:00:00.000Z',
};

describe('useCreatePayment', () => {
  it('resolves with the pending intent on a 200', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/payments', () => HttpResponse.json({ intent: pendingIntent })));

    const { result } = renderHook(() => useCreatePayment(), { wrapper });
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('pending');
  });

  it('sends the idempotency key in the Idempotency-Key header', async () => {
    setAccessToken('access_valid');
    let seenKey: string | null = null;
    server.use(
      http.post('*/api/payments', ({ request }) => {
        seenKey = request.headers.get('idempotency-key');
        return HttpResponse.json({ intent: pendingIntent });
      }),
    );

    const { result } = renderHook(() => useCreatePayment(), { wrapper });
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenKey).toBe(variables.idempotencyKey);
  });

  it('throws a typed PaymentValidationError with the balance on a 422 (US-CW-008 AC-01)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/payments', () =>
        HttpResponse.json(
          {
            error: 'insufficient_balance',
            availableBalance: { amountMinorUnits: 300_000, currency: 'USD' },
          },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => useCreatePayment({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(PaymentValidationError);
    expect((error as PaymentValidationError).code).toBe('insufficient_balance');
    expect((error as PaymentValidationError).availableBalance?.amountMinorUnits).toBe(300_000);
  });

  it('throws idempotency_mismatch on a 409 and does not retry it (US-CW-007 AC-05)', async () => {
    setAccessToken('access_valid');
    let calls = 0;
    server.use(
      http.post('*/api/payments', () => {
        calls += 1;
        return HttpResponse.json({ error: 'idempotency_mismatch' }, { status: 409 });
      }),
    );

    const { result } = renderHook(() => useCreatePayment({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as PaymentValidationError).code).toBe('idempotency_mismatch');
    expect(calls).toBe(1);
  });

  it('retries a 500 up to 3 times with the same key, then surfaces the failure (US-CW-007 AC-04)', async () => {
    setAccessToken('access_valid');
    let calls = 0;
    const keys: (string | null)[] = [];
    server.use(
      http.post('*/api/payments', ({ request }) => {
        calls += 1;
        keys.push(request.headers.get('idempotency-key'));
        return HttpResponse.json({ error: 'internal_error' }, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useCreatePayment({ retryDelayMs: () => 0 }), { wrapper });
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    // 1 initial attempt + 3 retries.
    expect(calls).toBe(4);
    // The same idempotency key is reused on every retry — never a duplicate payment.
    expect(new Set(keys)).toEqual(new Set([variables.idempotencyKey]));
  });

  it('throws PaymentTimeoutError when the request exceeds the timeout (US-CW-007 AC-03)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/payments', async () => {
        await delay(500);
        return HttpResponse.json({ intent: pendingIntent });
      }),
    );

    const { result } = renderHook(
      () => useCreatePayment({ retryDelayMs: () => 0, timeoutMs: 50 }),
      { wrapper },
    );
    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.error).toBeInstanceOf(PaymentTimeoutError);
  });
});
