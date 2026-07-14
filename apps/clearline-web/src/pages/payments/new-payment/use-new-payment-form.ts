import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type {
  CreatePaymentRequest,
  PaymentIntent,
  PaymentRecipient,
  StepUpChallenge,
} from '@clearline/contracts';
import { validatePayment } from '@clearline/domain-payments';
import { parseAmountToMinorUnits } from '@clearline/money';
import {
  PaymentTimeoutError,
  PaymentValidationError,
  PaymentsForbiddenError,
  useCreatePayment,
  useExchangeRate,
  useIdempotencyKey,
  usePaymentContext,
} from '@clearline/data-access-payments';
import { messageForPaymentError } from './new-payment-form';
import { clearDraft, readDraft, writeDraft } from './payment-draft';

/** An inline error tied to a field, optionally offering a limit-increase CTA. */
export interface ActiveError {
  field?: 'recipient' | 'amount';
  message: string;
  limitCta?: boolean;
}

/**
 * All state, validation and submission wiring for the New Payment form (US-CW-007/008/009). Balance,
 * daily-limit, self-transfer and closed-recipient checks run client-side via the same validatePayment
 * gate the server enforces, so doomed payments are blocked before any network call. Submission is
 * pessimistic — an idempotency key minted once, a confirm dialog with an irreversible countdown, then
 * "Processing…" until the server confirms — never an instant "Success". The server independently
 * re-validates everything and its 4xx reasons map back to the same inline copy.
 *
 * Returns a flat view-model consumed by NewPaymentPage and its presentational panels; the panels hold
 * no logic of their own.
 */
export function useNewPaymentForm() {
  const navigate = useNavigate();
  const context = usePaymentContext();
  const createPayment = useCreatePayment();

  const draft = useMemo(() => readDraft(), []);
  const [recipientId, setRecipientId] = useState<string | undefined>(draft?.recipientId);
  const [manualMode, setManualMode] = useState<boolean>(draft?.manualMode ?? false);
  const [routingNumber, setRoutingNumber] = useState(draft?.routingNumber ?? '');
  const [accountNumber, setAccountNumber] = useState(draft?.accountNumber ?? '');
  const [amountInput, setAmountInput] = useState(draft?.amountInput ?? '');
  const [memo, setMemo] = useState(draft?.memo ?? '');
  const [method, setMethod] = useState<'ach' | 'wire'>(draft?.method ?? 'ach');
  const [fxAcknowledged, setFxAcknowledged] = useState(false);
  const [clientError, setClientError] = useState<ActiveError | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Step-up (US-CW-010): a high-value payment comes back reserved in `requires_action` with a
  // challenge. `challengeIntent` holds the reserved intent for as long as it's unresolved — including
  // after the modal is closed (abandoned), which is what drives the "Authentication wasn't completed"
  // banner + Retry (AC-03). `challengeOpen` is just whether the modal itself is showing.
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [challengeIntent, setChallengeIntent] = useState<PaymentIntent | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const idempotency = useIdempotencyKey(draft?.idempotencyKey);

  const source = context.data?.source;
  const recipients = context.data?.recipients ?? [];
  const selectedRecipient = recipients.find((r) => r.id === recipientId);
  const sourceCurrency = source?.currency ?? 'USD';
  const amountMinor = parseAmountToMinorUnits(amountInput, sourceCurrency);
  const isCrossCurrency = !!selectedRecipient && selectedRecipient.currency !== sourceCurrency;

  const fx = useExchangeRate(
    sourceCurrency,
    selectedRecipient?.currency ?? sourceCurrency,
    amountMinor ?? 0,
    { enabled: isCrossCurrency && (amountMinor ?? 0) > 0 },
  );

  // Persist the draft (incl. the idempotency key) on every change, so a mid-submission session
  // timeout and redirect can rehydrate it on return (AC-06).
  useEffect(() => {
    writeDraft({
      recipientId,
      amountInput,
      memo,
      method,
      manualMode,
      routingNumber,
      accountNumber,
      idempotencyKey: idempotency.key,
    });
  }, [
    recipientId,
    amountInput,
    memo,
    method,
    manualMode,
    routingNumber,
    accountNumber,
    idempotency.key,
  ]);

  const serverError =
    createPayment.error instanceof PaymentValidationError ? createPayment.error : null;
  const isTimeout = createPayment.error instanceof PaymentTimeoutError;
  const isExhausted = createPayment.isError && !serverError && !isTimeout;

  // A server idempotency mismatch means the payload changed since the key was minted — this is a
  // genuinely new operation, so mint a fresh key for the resubmission (AC-05).
  useEffect(() => {
    if (serverError?.code === 'idempotency_mismatch') {
      idempotency.reset();
    }
    // Only react to the code transitioning, not to idempotency identity — hence the narrow dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverError?.code]);

  function runClientValidation(): ActiveError | null {
    if (!source) return { message: 'Loading your account…' };
    if (!selectedRecipient && !manualMode) {
      return { field: 'recipient', message: 'Choose a recipient or enter account details.' };
    }
    if (amountMinor === null) {
      return {
        field: 'amount',
        message: messageForPaymentError('invalid_amount', { currency: sourceCurrency }),
      };
    }
    const decision = validatePayment({
      amountMinorUnits: amountMinor,
      availableBalanceMinorUnits: source.availableBalance.amountMinorUnits,
      dailyLimitMinorUnits: source.dailyLimit.amountMinorUnits,
      dailySpentMinorUnits: source.dailySpent.amountMinorUnits,
      isSelfTransfer: selectedRecipient
        ? selectedRecipient.maskedAccount === source.maskedAccount
        : false,
      recipientStatus: selectedRecipient?.status,
    });
    if (!decision.ok) {
      return {
        field:
          decision.reason === 'recipient_closed' || decision.reason === 'self_transfer'
            ? 'recipient'
            : 'amount',
        message: messageForPaymentError(decision.reason, {
          availableBalance:
            decision.reason === 'insufficient_balance' ? source.availableBalance : undefined,
          dailyLimit: decision.reason === 'daily_limit_exceeded' ? source.dailyLimit : undefined,
        }),
        limitCta: decision.reason === 'daily_limit_exceeded',
      };
    }
    if (isCrossCurrency && !fxAcknowledged) {
      return {
        field: 'amount',
        message: fx.isError
          ? "We couldn't fetch the exchange rate. Retry to see the converted amount before sending."
          : 'Review and confirm the converted amount before sending.',
      };
    }
    return null;
  }

  function onReview() {
    const error = runClientValidation();
    setClientError(error);
    if (!error) setConfirmOpen(true);
  }

  function buildRequest(): CreatePaymentRequest {
    return {
      amount: { amountMinorUnits: amountMinor ?? 0, currency: sourceCurrency },
      method,
      ...(memo ? { memo } : {}),
      ...(manualMode
        ? { recipientAccount: { routingNumber, accountNumber } }
        : { recipientId: selectedRecipient?.id }),
    };
  }

  function submit() {
    createPayment.mutate(
      { request: buildRequest(), idempotencyKey: idempotency.key },
      {
        onSuccess: (response) => {
          // A high-value payment is reserved awaiting step-up (US-CW-010 AC-01): open the challenge
          // instead of navigating — no funds have moved yet, and the same key threads through it.
          if (response.intent.status === 'requires_action' && response.challenge) {
            setChallenge(response.challenge);
            setChallengeIntent(response.intent);
            setChallengeOpen(true);
            return;
          }
          clearDraft();
          navigate(`/payments/${response.intent.id}`);
        },
      },
    );
  }

  function onConfirm() {
    setConfirmOpen(false);
    submit();
  }

  // The step-up challenge cleared (AC-02): the payment has committed, so drop the draft and move to the
  // status page just like an ordinary payment.
  function onStepUpVerified(intent: PaymentIntent) {
    setChallengeOpen(false);
    setChallenge(null);
    setChallengeIntent(null);
    clearDraft();
    navigate(`/payments/${intent.id}`);
  }

  // Closing the modal without verifying abandons the challenge — the reserved intent stays
  // `requires_action`, so we keep `challengeIntent` to surface the banner + Retry (AC-03).
  function onChallengeOpenChange(open: boolean) {
    setChallengeOpen(open);
  }

  // "Retry verification" reopens the SAME reserved challenge — same intent, same idempotency key — so a
  // retry can never become a second payment (AC-03).
  function retryStepUp() {
    setChallengeOpen(true);
  }

  function selectRecipient(recipient: PaymentRecipient) {
    setManualMode(false);
    setRecipientId(recipient.id);
    setMethod(recipient.method);
    setFxAcknowledged(false);
    setClientError(null);
  }

  function enterManualMode() {
    setManualMode(true);
    setRecipientId(undefined);
    setClientError(null);
  }

  // A changed amount invalidates any prior cross-currency acknowledgement — the user must re-confirm
  // the newly converted amount before sending (US-CW-008 AC-06).
  function changeAmount(value: string) {
    setAmountInput(value);
    setFxAcknowledged(false);
  }

  const activeError: ActiveError | null = serverError
    ? {
        field: serverError.code === 'recipient_not_found' ? ('recipient' as const) : undefined,
        message: messageForPaymentError(serverError.code, {
          availableBalance: serverError.availableBalance,
          dailyLimit: serverError.dailyLimit,
        }),
        limitCta: serverError.code === 'daily_limit_exceeded',
      }
    : clientError;

  // Balance after this payment is itself a derived projection (available − amount) — shown read-only in
  // the Review panel. Fall back to the current available balance until a valid, in-balance amount exists.
  const projectedBalanceMinor =
    source && amountMinor !== null && amountMinor <= source.availableBalance.amountMinorUnits
      ? source.availableBalance.amountMinorUnits - amountMinor
      : (source?.availableBalance.amountMinorUnits ?? null);

  return {
    forbidden: context.error instanceof PaymentsForbiddenError,
    // Data
    source,
    sourceCurrency,
    recipients,
    selectedRecipient,
    amountMinor,
    isCrossCurrency,
    fx,
    // Form fields
    recipientId,
    manualMode,
    routingNumber,
    setRoutingNumber,
    accountNumber,
    setAccountNumber,
    amountInput,
    changeAmount,
    memo,
    setMemo,
    method,
    setMethod,
    fxAcknowledged,
    setFxAcknowledged,
    // Actions
    selectRecipient,
    enterManualMode,
    onReview,
    onConfirm,
    submit,
    // Submission + confirm state
    confirmOpen,
    setConfirmOpen,
    isPending: createPayment.isPending,
    isTimeout,
    isExhausted,
    // Step-up challenge (US-CW-010)
    challenge,
    challengeIntent,
    challengeOpen,
    awaitingStepUp: challengeIntent !== null && !challengeOpen,
    onChallengeOpenChange,
    onStepUpVerified,
    retryStepUp,
    // Derived view state
    activeError,
    projectedBalanceMinor,
    idempotencyKey: idempotency.key,
  };
}

export type NewPaymentForm = ReturnType<typeof useNewPaymentForm>;
