import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PaymentIntent,
  StepUpChallenge,
  StepUpChallengeResponse,
  StepUpErrorResponse,
  StepUpMethod,
  StepUpVerifyResponse,
} from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { PAYMENTS_CONTEXT_QUERY_KEY } from './payments-query-key';

/**
 * A wrong OTP — an authentication failure (US-CW-010 AC-04). Deliberately a different type from
 * {@link StepUpNetworkError} so the UI can show "We couldn't verify your identity…" for this and "We
 * lost connection during verification…" for that, and monitoring can tell fraud-relevant failures from
 * infrastructure ones.
 */
export class StepUpAuthError extends Error {
  constructor() {
    super('otp_incorrect');
    this.name = 'StepUpAuthError';
  }
}

/**
 * The submitted code had expired; the server invalidated it and issued a replacement before responding
 * (US-CW-010 AC-06). Carries the fresh challenge so the UI can seamlessly continue on the new code.
 */
export class StepUpExpiredError extends Error {
  readonly challenge: StepUpChallenge;
  constructor(challenge: StepUpChallenge) {
    super('otp_expired');
    this.name = 'StepUpExpiredError';
    this.challenge = challenge;
  }
}

/** Too many wrong attempts — the challenge is locked and needs a fresh code (brute-force guard). */
export class StepUpLockedError extends Error {
  constructor() {
    super('locked');
    this.name = 'StepUpLockedError';
  }
}

/**
 * The verify request never got a definitive answer from the server — a dropped connection or a 5xx
 * (US-CW-010 AC-07). Distinct from an auth failure: the user can retry without losing their place, and
 * the copy says so. Retrying is safe because the payment is still `requires_action` and un-committed.
 */
export class StepUpNetworkError extends Error {
  constructor() {
    super('step_up_network');
    this.name = 'StepUpNetworkError';
  }
}

async function postVerify(intentId: string, code: string): Promise<PaymentIntent> {
  let response: Response;
  try {
    response = await authenticatedFetch(`/api/payments/${intentId}/challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    // A thrown fetch is a connectivity failure that never reached the server (AC-07) — never an auth
    // failure, so it must not read as "wrong code".
    throw new StepUpNetworkError();
  }

  if (response.status === 422) {
    const body = (await response.json()) as StepUpErrorResponse;
    if (body.error === 'otp_expired') throw new StepUpExpiredError(body.challenge!);
    if (body.error === 'locked') throw new StepUpLockedError();
    throw new StepUpAuthError();
  }
  // A 404/5xx isn't an authentication decision — treat it as a retryable connectivity-class failure.
  if (!response.ok) throw new StepUpNetworkError();

  const body = (await response.json()) as StepUpVerifyResponse;
  return body.intent;
}

async function postResend(intentId: string, method?: StepUpMethod): Promise<StepUpChallenge> {
  const response = await authenticatedFetch(`/api/payments/${intentId}/challenge/resend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(method ? { method } : {}),
  });
  if (!response.ok) throw new StepUpNetworkError();
  const body = (await response.json()) as StepUpChallengeResponse;
  return body.challenge;
}

/**
 * Submits a step-up OTP for a reserved PaymentIntent (US-CW-010). Never auto-retries — each attempt is
 * a deliberate user action, and a silent retry could burn attempts toward a lockout or replay an
 * already-consumed code. On success the intent has committed, so the derived payment context (available
 * balance) is invalidated to reflect the debit. Failures surface as the typed step-up errors above so
 * the caller can render the right, distinct message (AC-02/AC-04/AC-06/AC-07).
 */
export function useVerifyStepUp(intentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => postVerify(intentId, code),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_CONTEXT_QUERY_KEY }),
  });
}

/**
 * Requests a fresh OTP for a reserved PaymentIntent — the "Resend" and "Try another method"
 * affordances (US-CW-010 AC-05). Passing a method switches the delivery channel; the server invalidates
 * the previous code as part of issuing the new one.
 */
export function useResendStepUp(intentId: string) {
  return useMutation({
    mutationFn: (method?: StepUpMethod) => postResend(intentId, method),
    retry: false,
  });
}
