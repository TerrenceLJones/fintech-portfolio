import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  Money,
  PaymentErrorCode,
  PaymentErrorResponse,
  PaymentIntent,
} from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import {
  MAX_PAYMENT_RETRIES,
  PAYMENT_TIMEOUT_MS,
  backoffDelayWithJitter,
} from '@clearline/domain-payments';
import { PAYMENTS_CONTEXT_QUERY_KEY } from './payments-query-key';

/**
 * A server-side rejection the client maps to the design's exact inline copy — over-balance (with the
 * available balance), over daily-limit (with the limit), a bad/closed/self recipient, an idempotency
 * mismatch, or an outright permission block. Distinct from a transient network/5xx failure so the
 * caller shows specific guidance and — critically — never auto-retries a decision the server has
 * already made (retrying wouldn't change it and could double-charge on a mismatch).
 */
export class PaymentValidationError extends Error {
  readonly code: PaymentErrorCode;
  readonly availableBalance?: Money;
  readonly dailyLimit?: Money;

  constructor(
    code: PaymentErrorCode,
    detail: { availableBalance?: Money; dailyLimit?: Money } = {},
  ) {
    super(`payment_rejected: ${code}`);
    this.name = 'PaymentValidationError';
    this.code = code;
    this.availableBalance = detail.availableBalance;
    this.dailyLimit = detail.dailyLimit;
  }
}

/**
 * The request got no definitive answer within the timeout. The client must NOT resubmit — it polls or
 * awaits the webhook for the PaymentIntent's real status, reusing the same idempotency key, so a slow
 * network never turns into a duplicate payment (US-CW-007 AC-03).
 */
export class PaymentTimeoutError extends Error {
  constructor() {
    super('payment_timeout');
    this.name = 'PaymentTimeoutError';
  }
}

export interface CreatePaymentVariables {
  request: CreatePaymentRequest;
  /**
   * The UUID v4 idempotency key, generated once per payment intent by the caller and passed unchanged
   * across every retry (React Query re-invokes the mutation with the same variables), so money moves
   * exactly once.
   */
  idempotencyKey: string;
}

export interface UseCreatePaymentOptions {
  /** Overridable for tests — production uses full-jitter exponential backoff. */
  retryDelayMs?: (attempt: number) => number;
  /** Overridable for tests — production enforces the 30-second timeout. */
  timeoutMs?: number;
}

async function postPayment(
  { request, idempotencyKey }: CreatePaymentVariables,
  timeoutMs: number,
): Promise<PaymentIntent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await authenticatedFetch('/api/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    // An abort is the timeout firing — a distinct, non-retriable state (poll instead of resubmit).
    if (controller.signal.aborted) throw new PaymentTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  // Idempotency mismatch and permission blocks are 4xx the server has decided — never retried.
  if (response.status === 409) throw new PaymentValidationError('idempotency_mismatch');
  if (response.status === 403) throw new PaymentValidationError('forbidden');
  if (response.status === 422) {
    const body = (await response.json()) as PaymentErrorResponse;
    throw new PaymentValidationError(body.error, {
      availableBalance: body.availableBalance,
      dailyLimit: body.dailyLimit,
    });
  }
  // 5xx / unexpected — a transient failure eligible for retry.
  if (!response.ok) throw new Error('payment_failed');

  const body = (await response.json()) as CreatePaymentResponse;
  return body.intent;
}

/**
 * Retries only transient failures (network/5xx) up to MAX_PAYMENT_RETRIES with full-jitter backoff
 * (US-CW-007 AC-04). A PaymentValidationError (server's 4xx decision) and a PaymentTimeoutError (poll,
 * don't resubmit) are never retried.
 */
function shouldRetryPayment(failureCount: number, error: unknown): boolean {
  if (error instanceof PaymentValidationError || error instanceof PaymentTimeoutError) {
    return false;
  }
  // failureCount is the number of retries already made (0 on the first failure), matching use-login.
  return failureCount < MAX_PAYMENT_RETRIES;
}

/**
 * Submits a vendor payment with exactly-once guarantees: a caller-supplied idempotency key reused
 * across retries, a 30s timeout that hands off to status polling rather than resubmitting, and
 * full-jitter retry of transient failures only. On success the payment context is refetched so the
 * derived available balance reflects the debit.
 */
export function useCreatePayment(options: UseCreatePaymentOptions = {}) {
  const queryClient = useQueryClient();
  const retryDelay = options.retryDelayMs ?? ((attempt: number) => backoffDelayWithJitter(attempt));
  const timeoutMs = options.timeoutMs ?? PAYMENT_TIMEOUT_MS;

  return useMutation({
    mutationFn: (variables: CreatePaymentVariables) => postPayment(variables, timeoutMs),
    retry: shouldRetryPayment,
    retryDelay,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_CONTEXT_QUERY_KEY }),
  });
}
