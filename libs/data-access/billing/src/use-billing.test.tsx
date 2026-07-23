import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import {
  BillingActionError,
  BillingForbiddenError,
  useBilling,
  useBillingStatus,
  useCancelSubscription,
  useUpdatePaymentMethod,
} from './use-billing';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({
  queries: { retry: false },
  mutations: { retry: false },
}).wrapper;

afterEach(() => clearAccessToken());

describe('useBilling', () => {
  it('surfaces a 403 as a typed BillingForbiddenError (AC-08)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/billing', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { result } = renderHook(() => useBilling(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BillingForbiddenError);
  });

  it('returns the summary on success', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/billing', () => HttpResponse.json({ planName: 'Growth' })));
    const { result } = renderHook(() => useBilling(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.planName).toBe('Growth');
  });
});

describe('useBillingStatus', () => {
  it('reads the subscription status for the grace banner (any role)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/billing/status', () =>
        HttpResponse.json({ status: 'canceled_grace', accessUntil: '2026-08-01' }),
      ),
    );
    const { result } = renderHook(() => useBillingStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('canceled_grace');
  });
});

describe('useUpdatePaymentMethod', () => {
  it('maps a declined card (402) to BillingActionError("card_declined") (AC-03)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/billing/payment-method', () =>
        HttpResponse.json({ error: 'card_declined' }, { status: 402 }),
      ),
    );
    const { result } = renderHook(() => useUpdatePaymentMethod(), { wrapper });
    result.current.mutate('tok_declined');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BillingActionError);
    expect((result.current.error as BillingActionError).code).toBe('card_declined');
  });
});

describe('useCancelSubscription', () => {
  it('maps a name mismatch (422) to BillingActionError("name_mismatch") (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/billing/cancel', () =>
        HttpResponse.json({ error: 'name_mismatch' }, { status: 422 }),
      ),
    );
    const { result } = renderHook(() => useCancelSubscription(), { wrapper });
    result.current.mutate('Wrong Name');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as BillingActionError).code).toBe('name_mismatch');
  });
});
