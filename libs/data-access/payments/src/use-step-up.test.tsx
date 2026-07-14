import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import {
  StepUpAuthError,
  StepUpExpiredError,
  StepUpLockedError,
  StepUpNetworkError,
  useResendStepUp,
  useVerifyStepUp,
} from './use-step-up';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({});
const INTENT = 'pi_1';
const VERIFY_URL = '*/api/payments/:id/challenge/verify';
const RESEND_URL = '*/api/payments/:id/challenge/resend';

const committed = {
  id: INTENT,
  status: 'pending',
  amount: { amountMinorUnits: 1_200_000, currency: 'USD' },
  recipientName: 'Acme Corp',
  recipientMasked: '••4188',
  method: 'ach',
  createdDate: '2026-07-08T00:00:00.000Z',
};

afterEach(() => clearAccessToken());

describe('useVerifyStepUp', () => {
  it('resolves with the committed intent on a correct code (AC-02)', async () => {
    setAccessToken('access_valid');
    server.use(http.post(VERIFY_URL, () => HttpResponse.json({ intent: committed })));

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('424242');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('pending');
  });

  it('throws StepUpAuthError on a wrong code, distinct from a network failure (AC-04)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY_URL, () => HttpResponse.json({ error: 'otp_incorrect' }, { status: 422 })),
    );

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('111111');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(StepUpAuthError);
  });

  it('throws StepUpExpiredError carrying the fresh challenge on an expired code (AC-06)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY_URL, () =>
        HttpResponse.json(
          {
            error: 'otp_expired',
            challenge: { intentId: INTENT, method: 'otp_sms', destinationMasked: '•••-•••-4417' },
          },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('000000');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(StepUpExpiredError);
    expect((result.current.error as StepUpExpiredError).challenge.destinationMasked).toBe(
      '•••-•••-4417',
    );
  });

  it('throws StepUpLockedError after too many attempts', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY_URL, () => HttpResponse.json({ error: 'locked' }, { status: 422 })),
    );

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('424242');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(StepUpLockedError);
  });

  it('throws StepUpNetworkError when the request never reaches the server (AC-07)', async () => {
    setAccessToken('access_valid');
    server.use(http.post(VERIFY_URL, () => HttpResponse.error()));

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('424242');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(StepUpNetworkError);
  });

  it('does not auto-retry a wrong code (each attempt is a deliberate user action)', async () => {
    setAccessToken('access_valid');
    let calls = 0;
    server.use(
      http.post(VERIFY_URL, () => {
        calls += 1;
        return HttpResponse.json({ error: 'otp_incorrect' }, { status: 422 });
      }),
    );

    const { result } = renderHook(() => useVerifyStepUp(INTENT), { wrapper });
    result.current.mutate('111111');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });
});

describe('useResendStepUp', () => {
  it('resolves with a fresh challenge and can switch the method (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(RESEND_URL, async ({ request }) => {
        const body = (await request.json()) as { method?: string };
        return HttpResponse.json({
          challenge: {
            intentId: INTENT,
            method: body.method ?? 'otp_sms',
            destinationMasked: body.method === 'otp_email' ? 'm•••@clearline.com' : '•••-•••-4417',
          },
        });
      }),
    );

    const { result } = renderHook(() => useResendStepUp(INTENT), { wrapper });
    result.current.mutate('otp_email');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.method).toBe('otp_email');
    expect(result.current.data?.destinationMasked).toBe('m•••@clearline.com');
  });
});
