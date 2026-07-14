import { Button, Icon, Modal, OtpInput, Text, formatMoneyValue } from '@clearline/ui';
import { STEP_UP_THRESHOLD_MINOR_UNITS } from '@clearline/domain-payments';
import { messageForStepUpError } from './step-up-messages';
import type { StepUpChallengeController } from './use-step-up-challenge';

const thresholdLabel = formatMoneyValue({
  amountMinorUnits: STEP_UP_THRESHOLD_MINOR_UNITS,
  currency: 'USD',
});

/** "0:24" — the resend countdown, matching the design. */
function formatCountdown(seconds: number): string {
  return `0:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}

/**
 * The step-up modal's OTP-entry face (US-CW-010): the code cells plus its notice states — wrong code
 * (AC-04) and expired-and-reissued (AC-06), kept visually distinct — the Verify action, and the
 * resend / alternative-method affordances gated by the 30-second timer (AC-05). The connectivity
 * failure (AC-07) is a separate face, so any `errorKind` reaching here is an entry-state notice.
 */
export function StepUpChallengeEntry({ controller }: { controller: StepUpChallengeController }) {
  const {
    destinationMasked,
    code,
    changeCode,
    submit,
    onComplete,
    requestResend,
    errorKind,
    isVerifying,
    resendReady,
    secondsToResend,
    method,
    otpLength,
  } = controller;

  const otpState = errorKind === 'incorrect' || errorKind === 'locked' ? 'error' : 'default';
  const altMethod = method === 'otp_sms' ? 'otp_email' : 'otp_sms';

  return (
    <>
      <div className="bg-cl-accent-weak mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
        <Icon name="shield" size={20} className="text-cl-accent-text" />
      </div>
      <Modal.Title asChild>
        <Text as="h2" size="heading" tone="default" className="mb-1">
          Verify it&apos;s you
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" size="label" tone="muted" className="mb-4 leading-relaxed">
          Enter the {otpLength}-digit code sent to {destinationMasked}. Required for transfers over{' '}
          {thresholdLabel}.
        </Text>
      </Modal.Description>

      {errorKind ? (
        <div
          role="alert"
          className={`mb-3.5 flex items-start gap-1.5 rounded-lg px-2.75 py-2.25 text-left ${
            errorKind === 'expired' ? 'bg-cl-warn-weak' : 'bg-cl-neg-weak'
          }`}
        >
          <Icon
            name={errorKind === 'expired' ? 'clock' : 'x-circle'}
            size={14}
            className={`mt-0.25 flex-shrink-0 ${
              errorKind === 'expired' ? 'text-cl-warn' : 'text-cl-neg'
            }`}
          />
          <Text
            as="span"
            size="label"
            className={errorKind === 'expired' ? 'text-cl-warn' : 'text-cl-neg'}
          >
            {messageForStepUpError(errorKind)}
          </Text>
        </div>
      ) : null}

      <div className="mb-3.5">
        <OtpInput
          value={code}
          onChange={changeCode}
          onComplete={onComplete}
          length={otpLength}
          state={otpState}
          disabled={isVerifying}
          autoFocus
        />
      </div>

      <Button
        fullWidth
        loading={isVerifying}
        disabled={code.length !== otpLength}
        onClick={() => submit()}
      >
        {errorKind === 'incorrect' ? 'Try again' : 'Verify'}
      </Button>

      <div className="mt-2.5 flex flex-col items-center gap-1.5">
        {resendReady ? (
          <>
            <Button
              variant="link"
              icon="refresh"
              onClick={() => requestResend()}
              className="text-cl-accent-text"
            >
              Didn&apos;t get the code? Resend
            </Button>
            <Button variant="link" onClick={() => requestResend(altMethod)}>
              Try another method
            </Button>
          </>
        ) : (
          <Text as="p" size="mono" tone="muted">
            Resend in {formatCountdown(secondsToResend)}
          </Text>
        )}
        {/* AC-04: an alternative method is offered the moment a code is rejected, without waiting out
            the resend timer. */}
        {errorKind === 'incorrect' && !resendReady ? (
          <Button variant="link" onClick={() => requestResend(altMethod)}>
            Use a different method
          </Button>
        ) : null}
      </div>
    </>
  );
}
