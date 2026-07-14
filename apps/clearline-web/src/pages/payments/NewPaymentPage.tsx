import { AccessDenied, ConfirmationDialog, Text, formatMoneyValue } from '@clearline/ui';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AmountMethodFields } from './new-payment/AmountMethodFields';
import { CrossCurrencyPanel } from './new-payment/CrossCurrencyPanel';
import { MemoField } from './new-payment/MemoField';
import { PayFromPanel } from './new-payment/PayFromPanel';
import { PaymentFormAlerts } from './new-payment/PaymentFormAlerts';
import { RecipientPicker } from './new-payment/RecipientPicker';
import { ReviewSummary } from './new-payment/ReviewSummary';
import { StepUpChallenge } from './new-payment/StepUpChallenge';
import { StepUpAbandonedBanner } from './new-payment/StepUpAbandonedBanner';
import { useNewPaymentForm } from './new-payment/use-new-payment-form';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { newPaymentBeacon } from './NewPaymentPage.beacon';

/**
 * The New Payment form (US-CW-007/008/009). All state, validation and submission wiring lives in
 * {@link useNewPaymentForm}; this component composes the derived view-model into the two-panel layout
 * — the form on the left, the derived Review summary on the right.
 */
export function NewPaymentPage() {
  usePageTitle('New payment');
  const form = useNewPaymentForm();
  useDemoBeacon(newPaymentBeacon);

  if (form.forbidden) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/payments/context" />;
  }

  return (
    <div className="font-sans">
      {/* Fills the shell's content column (design spans the full width, split ~1.35 / 0.9). */}
      <div className="w-full">
        <div className="border-cl-border bg-cl-bg overflow-hidden rounded-xl border md:flex">
          {/* ── Left: the payment form ───────────────────────────────────────── */}
          <div className="flex-[1.35] p-6 md:p-7">
            <Text as="h2" size="heading" className="mb-1">
              New payment
            </Text>
            <Text as="p" size="label" tone="muted" className="mb-5">
              Initiate a transfer to a verified vendor.
            </Text>

            <PayFromPanel source={form.source} />

            <RecipientPicker
              recipients={form.recipients}
              recipientId={form.recipientId}
              manualMode={form.manualMode}
              routingNumber={form.routingNumber}
              accountNumber={form.accountNumber}
              activeError={form.activeError}
              onSelect={form.selectRecipient}
              onEnterManualMode={form.enterManualMode}
              onRoutingNumberChange={form.setRoutingNumber}
              onAccountNumberChange={form.setAccountNumber}
            />

            <AmountMethodFields
              amountInput={form.amountInput}
              method={form.method}
              sourceCurrency={form.sourceCurrency}
              activeError={form.activeError}
              onAmountChange={form.changeAmount}
              onMethodChange={form.setMethod}
            />

            <MemoField memo={form.memo} onMemoChange={form.setMemo} />

            {form.isCrossCurrency ? (
              <CrossCurrencyPanel
                selectedRecipient={form.selectedRecipient}
                sourceCurrency={form.sourceCurrency}
                amountMinor={form.amountMinor}
                fx={form.fx}
                fxAcknowledged={form.fxAcknowledged}
                onFxAcknowledgedChange={form.setFxAcknowledged}
              />
            ) : null}

            <PaymentFormAlerts
              isTimeout={form.isTimeout}
              isExhausted={form.isExhausted}
              activeError={form.activeError}
              onRetry={form.submit}
            />

            {/* AC-03: after an abandoned step-up, the reserved payment is still waiting — surface it
                with a Retry that reopens the same challenge (same idempotency key). */}
            {form.awaitingStepUp && form.challengeIntent ? (
              <StepUpAbandonedBanner
                recipientName={form.challengeIntent.recipientName}
                recipientMasked={form.challengeIntent.recipientMasked}
                amountMinor={form.challengeIntent.amount.amountMinorUnits}
                currency={form.challengeIntent.amount.currency}
                idempotencyKey={form.idempotencyKey}
                onRetry={form.retryStepUp}
              />
            ) : null}
          </div>

          {/* ── Right: the derived Review summary ─────────────────────────────── */}
          <ReviewSummary
            method={form.method}
            currency={form.sourceCurrency}
            amountMinor={form.amountMinor}
            projectedBalanceMinor={form.projectedBalanceMinor}
            isPending={form.isPending}
            isTimeout={form.isTimeout}
            idempotencyKey={form.idempotencyKey}
            onReview={form.onReview}
          />
        </div>
      </div>

      <ConfirmationDialog
        open={form.confirmOpen}
        onOpenChange={form.setConfirmOpen}
        title={`Send ${
          form.amountMinor !== null
            ? formatMoneyValue({
                amountMinorUnits: form.amountMinor,
                currency: form.sourceCurrency,
              })
            : ''
        } to ${form.selectedRecipient?.name ?? 'this recipient'}?`}
        body="This transfers funds immediately and can't be undone. Recovering it would require a reversing entry."
        confirmLabel="Send payment"
        onConfirm={form.onConfirm}
      />

      {/* Mounted for as long as a reserved payment awaits step-up — open while the modal shows,
          closed (but retained) once abandoned so the banner above can offer a Retry (US-CW-010). */}
      {form.challenge ? (
        <StepUpChallenge
          challenge={form.challenge}
          open={form.challengeOpen}
          onOpenChange={form.onChallengeOpenChange}
          onVerified={form.onStepUpVerified}
        />
      ) : null}
    </div>
  );
}
