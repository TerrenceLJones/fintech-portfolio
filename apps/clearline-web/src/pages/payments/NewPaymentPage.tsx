import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CreatePaymentRequest, PaymentRecipient } from '@clearline/contracts';
import { validatePayment } from '@clearline/domain-payments';
import { toMajorUnits } from '@clearline/money';
import {
  AccessDenied,
  Alert,
  Button,
  ConfirmationDialog,
  MoneyDisplay,
  SegmentedControl,
  Text,
  TextField,
  formatMoney,
} from '@clearline/ui';
import {
  PaymentTimeoutError,
  PaymentValidationError,
  PaymentsForbiddenError,
  useCreatePayment,
  useExchangeRate,
  useIdempotencyKey,
  usePaymentContext,
} from '@clearline/data-access-payments';
import { usePageTitle } from '../../hooks/usePageTitle';
import { messageForPaymentError, parseAmountToMinorUnits } from './new-payment-form';

const DRAFT_KEY = 'clearline:payment-draft';
const METHOD_OPTIONS = ['ACH', 'Wire'] as const;

interface PaymentDraft {
  recipientId?: string;
  amountInput: string;
  memo: string;
  method: 'ach' | 'wire';
  manualMode: boolean;
  routingNumber: string;
  accountNumber: string;
  idempotencyKey: string;
}

/**
 * Reads the in-progress payment draft. AC-06 preserves the amount, recipient, memo AND the idempotency
 * key across a session-expiry redirect, so re-authentication resumes the exact same PaymentIntent
 * rather than starting a new one — the persisted key is what makes that a resume, not a duplicate.
 */
function readDraft(): Partial<PaymentDraft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<PaymentDraft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: PaymentDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // A full sessionStorage (or a privacy mode that throws) shouldn't break the form.
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function formatUsd(amountMinorUnits: number): string {
  return formatMoney(toMajorUnits({ amountMinorUnits, currency: 'USD' }), 'USD');
}

/**
 * The New Payment form (US-CW-007/008/009). Balance, daily-limit, self-transfer and closed-recipient
 * checks run client-side via the same validatePayment gate the server enforces, so doomed payments are
 * blocked before any network call. Submission is pessimistic — an idempotency key minted once, a
 * confirm dialog with an irreversible countdown, then "Processing…" until the server confirms —
 * never an instant "Success". The server independently re-validates everything and its 4xx reasons
 * map back to the same inline copy.
 */
export function NewPaymentPage() {
  usePageTitle('New payment');
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
  const [clientError, setClientError] = useState<{
    field?: 'recipient' | 'amount';
    message: string;
    limitCta?: boolean;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const idempotency = useIdempotencyKey(draft?.idempotencyKey);

  const source = context.data?.source;
  const recipients = context.data?.recipients ?? [];
  const selectedRecipient = recipients.find((r) => r.id === recipientId);
  const amountMinor = parseAmountToMinorUnits(amountInput);
  const isCrossCurrency = !!selectedRecipient && selectedRecipient.currency !== 'USD';

  const fx = useExchangeRate('USD', selectedRecipient?.currency ?? 'USD', amountMinor ?? 0, {
    enabled: isCrossCurrency && (amountMinor ?? 0) > 0,
  });

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
    // Only react to the code transitioning, not to idempotency identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverError?.code]);

  if (context.error instanceof PaymentsForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/payments/context" />;
  }

  function runClientValidation(): typeof clientError {
    if (!source) return { message: 'Loading your account…' };
    if (!selectedRecipient && !manualMode) {
      return { field: 'recipient', message: 'Choose a recipient or enter account details.' };
    }
    if (amountMinor === null) {
      return { field: 'amount', message: 'Enter an amount greater than $0.' };
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
        message: 'Review and confirm the converted amount before sending.',
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
      amount: { amountMinorUnits: amountMinor ?? 0, currency: 'USD' },
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
        onSuccess: (intent) => {
          clearDraft();
          navigate(`/payments/${intent.id}`);
        },
      },
    );
  }

  function onConfirm() {
    setConfirmOpen(false);
    submit();
  }

  function selectRecipient(recipient: PaymentRecipient) {
    setManualMode(false);
    setRecipientId(recipient.id);
    setMethod(recipient.method);
    setFxAcknowledged(false);
    setClientError(null);
  }

  const activeError = serverError
    ? {
        field: serverError.code === 'recipient_not_found' ? ('recipient' as const) : undefined,
        message: messageForPaymentError(serverError.code, {
          availableBalance: serverError.availableBalance,
          dailyLimit: serverError.dailyLimit,
        }),
        limitCta: serverError.code === 'daily_limit_exceeded',
      }
    : clientError;

  return (
    <div className="font-sans">
      <div className="mx-auto max-w-[520px]">
        <Text as="h2" size="heading" className="mb-1">
          New payment
        </Text>
        <Text as="p" size="label" tone="muted" className="mb-6">
          Initiate a transfer to a verified vendor.
        </Text>

        {/* Pay from — a derived, read-only balance (no input affordance, US-CW-008). */}
        <div className="border-cl-border bg-cl-surface mb-5 rounded-xl border p-4">
          <Text as="div" size="label" tone="muted" className="mb-1">
            Pay from {source ? `${source.name} · ${source.maskedAccount}` : ''}
          </Text>
          <MoneyDisplay
            amount={source ? toMajorUnits(source.availableBalance) : 0}
            state={context.isPending ? 'loading' : 'loaded'}
            derived
          />
        </div>

        {/* Recipient picker */}
        <div className="mb-5">
          <Text as="div" size="label" tone="muted" className="mb-2">
            Recipient
          </Text>
          <ul className="flex flex-col gap-2">
            {recipients.map((recipient) => {
              const selected = !manualMode && recipient.id === recipientId;
              return (
                <li key={recipient.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectRecipient(recipient)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left ${
                      selected
                        ? 'border-cl-accent bg-cl-accent-weak'
                        : 'border-cl-border-2 bg-cl-surface'
                    }`}
                  >
                    <span>
                      <Text as="span" size="body" weight="semibold">
                        {recipient.name}
                      </Text>
                      <Text as="span" size="label" tone="faint" className="ml-2">
                        {recipient.method.toUpperCase()} · {recipient.maskedAccount}
                      </Text>
                    </span>
                    {recipient.status === 'closed' ? (
                      <Text as="span" size="label" weight="semibold" className="text-cl-neg">
                        Closed
                      </Text>
                    ) : (
                      <Text as="span" size="label" weight="semibold" className="text-cl-pos">
                        Verified
                      </Text>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setManualMode(true);
              setRecipientId(undefined);
              setClientError(null);
            }}
            className="text-cl-accent-text mt-2 text-[12px] font-semibold"
          >
            Recipient not listed? Enter account details
          </button>
          {manualMode ? (
            <div className="mt-3 flex flex-col gap-3">
              <TextField
                label="Routing number"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                state={activeError?.field === 'recipient' ? 'error' : undefined}
              />
              <TextField
                label="Account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                state={activeError?.field === 'recipient' ? 'error' : undefined}
              />
            </div>
          ) : null}
        </div>

        {/* Amount + method */}
        <div className="mb-4">
          <TextField
            label="Amount"
            inputMode="decimal"
            prefix="$"
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              // A changed amount invalidates any prior cross-currency acknowledgement — the user must
              // re-confirm the newly converted amount before sending (US-CW-008 AC-06).
              setFxAcknowledged(false);
            }}
            state={activeError?.field === 'amount' ? 'error' : undefined}
          />
        </div>
        <div className="mb-4">
          <Text as="div" size="label" tone="muted" className="mb-1.5">
            Method
          </Text>
          <SegmentedControl
            options={[...METHOD_OPTIONS]}
            value={method === 'ach' ? 'ACH' : 'Wire'}
            onChange={(value) => setMethod(value === 'ACH' ? 'ach' : 'wire')}
          />
        </div>
        <div className="mb-5">
          <TextField
            label="Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. Q2 platform license — INV-20418"
          />
        </div>

        {/* Cross-currency: non-blocking banner + converted amount, confirmed before send (AC-06) */}
        {isCrossCurrency ? (
          <div className="mb-5">
            <Alert
              tone="info"
              title={`This recipient uses ${selectedRecipient?.currency}. Review the converted amount before sending.`}
            />
            {fx.data ? (
              <div className="border-cl-border bg-cl-surface mt-3 rounded-lg border p-3">
                <div className="flex justify-between py-1">
                  <Text as="span" size="label" tone="muted">
                    You send
                  </Text>
                  <Text as="span" size="mono">
                    {amountMinor !== null ? formatUsd(amountMinor) : '—'} USD
                  </Text>
                </div>
                <div className="flex justify-between py-1">
                  <Text as="span" size="label" tone="muted">
                    Exchange rate
                  </Text>
                  <Text as="span" size="mono">
                    1 USD = {fx.data.rate.rate} {fx.data.rate.toCurrency}
                  </Text>
                </div>
                <div className="flex justify-between py-1">
                  <Text as="span" size="label" tone="muted">
                    Recipient gets
                  </Text>
                  <Text as="span" size="mono" weight="semibold">
                    {formatMoney(
                      toMajorUnits(fx.data.convertedAmount),
                      fx.data.convertedAmount.currency,
                    )}{' '}
                    {fx.data.convertedAmount.currency}
                  </Text>
                </div>
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fxAcknowledged}
                    onChange={(e) => setFxAcknowledged(e.target.checked)}
                  />
                  <Text as="span" size="label">
                    Confirm converted amount
                  </Text>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Status/error banners */}
        {isTimeout ? (
          <div className="mb-4">
            <Alert
              tone="info"
              title="We're still confirming your payment. We'll update this in a moment — don't resubmit."
            />
          </div>
        ) : isExhausted ? (
          <div className="mb-4">
            <Alert
              tone="negative"
              title="Couldn't process this payment. Try again."
              action="Retry"
              onAction={submit}
            />
          </div>
        ) : activeError?.message ? (
          <div className="mb-4">
            <div role="alert" className="text-cl-neg text-[12px] font-medium">
              {activeError.message}
            </div>
            {activeError.limitCta ? (
              <Button variant="link" size="sm" className="mt-1 px-0">
                Request limit increase
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          fullWidth
          onClick={onReview}
          loading={createPayment.isPending}
          disabled={isTimeout}
        >
          Review &amp; send
        </Button>
        {createPayment.isPending ? (
          <Text as="p" size="label" tone="muted" className="mt-2 text-center">
            Processing…
          </Text>
        ) : null}
        <Text as="p" size="mono" tone="faint" className="mt-3 text-center">
          idempotency-key {idempotency.key.slice(0, 8)}…
        </Text>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send ${amountMinor !== null ? formatUsd(amountMinor) : ''} to ${
          selectedRecipient?.name ?? 'this recipient'
        }?`}
        body="This transfers funds immediately and can't be undone. Recovering it would require a reversing entry."
        confirmLabel="Send payment"
        onConfirm={onConfirm}
      />
    </div>
  );
}
