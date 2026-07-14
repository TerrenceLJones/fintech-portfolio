import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import type { StepUpChallenge } from '@clearline/contracts';
import { useStepUpChallenge } from './use-step-up-challenge';

const server = registerMswServer();
const VERIFY = '*/api/payments/:id/challenge/verify';
const RESEND = '*/api/payments/:id/challenge/resend';

const challenge: StepUpChallenge = {
  intentId: 'pi_1',
  method: 'otp_sms',
  destinationMasked: '•••-•••-4417',
};

const committed = {
  id: 'pi_1',
  status: 'pending',
  amount: { amountMinorUnits: 1_200_000, currency: 'USD' },
  recipientName: 'Acme Corp',
  recipientMasked: '••4188',
  method: 'ach',
  createdDate: '2026-07-08T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderChallenge(onVerified = vi.fn()) {
  return renderHook(() => useStepUpChallenge({ challenge, onVerified, resendDelaySeconds: 1 }), {
    wrapper,
  });
}

afterEach(() => clearAccessToken());

describe('useStepUpChallenge', () => {
  it('calls onVerified with the committed intent on the correct code (AC-02)', async () => {
    setAccessToken('access_valid');
    server.use(http.post(VERIFY, () => HttpResponse.json({ intent: committed })));
    const onVerified = vi.fn();
    const { result } = renderChallenge(onVerified);

    act(() => result.current.changeCode('424242'));
    act(() => result.current.submit());

    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(onVerified.mock.calls[0]![0]).toEqual(committed);
  });

  it('maps a wrong code to the "incorrect" kind, distinct from network (AC-04)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY, () => HttpResponse.json({ error: 'otp_incorrect' }, { status: 422 })),
    );
    const { result } = renderChallenge();

    act(() => result.current.changeCode('111111'));
    act(() => result.current.submit());

    await waitFor(() => expect(result.current.errorKind).toBe('incorrect'));
  });

  it('swaps in the fresh challenge and shows the expiry kind on an expired code (AC-06)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY, () =>
        HttpResponse.json(
          {
            error: 'otp_expired',
            challenge: { intentId: 'pi_1', method: 'otp_email', destinationMasked: 'm•••@x.com' },
          },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderChallenge();

    act(() => result.current.changeCode('000000'));
    act(() => result.current.submit());

    await waitFor(() => expect(result.current.errorKind).toBe('expired'));
    // The code field is cleared and the new destination is adopted.
    expect(result.current.code).toBe('');
    expect(result.current.destinationMasked).toBe('m•••@x.com');
  });

  it('maps a connectivity failure to the "network" kind (AC-07)', async () => {
    setAccessToken('access_valid');
    server.use(http.post(VERIFY, () => HttpResponse.error()));
    const { result } = renderChallenge();

    act(() => result.current.changeCode('424242'));
    act(() => result.current.submit());

    await waitFor(() => expect(result.current.errorKind).toBe('network'));
  });

  it('activates resend only after the delay elapses (AC-05)', async () => {
    setAccessToken('access_valid');
    const { result } = renderChallenge();
    expect(result.current.resendReady).toBe(false);

    // resendDelaySeconds is 1 in the harness — wait for the countdown to reach zero.
    await waitFor(() => expect(result.current.resendReady).toBe(true), { timeout: 2000 });
  });

  it('clears the code and error when the modal is reopened on Retry (AC-03)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(VERIFY, () => HttpResponse.json({ error: 'otp_incorrect' }, { status: 422 })),
    );
    const { result, rerender } = renderHook(
      ({ open }) =>
        useStepUpChallenge({ challenge, open, onVerified: vi.fn(), resendDelaySeconds: 30 }),
      { wrapper, initialProps: { open: true } },
    );

    // Type a wrong code so there's stale state to clear.
    act(() => result.current.changeCode('111111'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.errorKind).toBe('incorrect'));

    // Abandon (close) then Retry (reopen) → clean slate.
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.errorKind).toBeNull();
    expect(result.current.code).toBe('');
  });

  it('resends a fresh code and clears any error (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post(RESEND, () =>
        HttpResponse.json({
          challenge: { intentId: 'pi_1', method: 'otp_sms', destinationMasked: '•••-•••-4417' },
        }),
      ),
    );
    const { result } = renderChallenge();

    act(() => result.current.requestResend());
    await waitFor(() => expect(result.current.isResending).toBe(false));
    expect(result.current.errorKind).toBeNull();
    expect(result.current.code).toBe('');
  });
});
