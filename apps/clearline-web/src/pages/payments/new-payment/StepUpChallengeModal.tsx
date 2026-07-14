import { Button, Dialog, Icon, OtpInput, Text, formatMoneyValue } from '@clearline/ui';
import { STEP_UP_THRESHOLD_MINOR_UNITS } from '@clearline/domain-payments';
import { messageForStepUpError } from './step-up-messages';
import type { StepUpChallengeController } from './use-step-up-challenge';

interface StepUpChallengeModalProps {
  open: boolean;
  /** Closing the modal without verifying is an abandonment (US-CW-010 AC-03). */
  onOpenChange: (open: boolean) => void;
  controller: StepUpChallengeController;
}

const thresholdLabel = formatMoneyValue({
  amountMinorUnits: STEP_UP_THRESHOLD_MINOR_UNITS,
  currency: 'USD',
});

/** "0:24" — the resend countdown, matching the design. */
function formatCountdown(seconds: number): string {
  return `0:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}

/**
 * The step-up (3DS-style) challenge overlay for a high-value payment (US-CW-010). Built on Radix
 * `Dialog` so focus-trap, Escape-to-close and ARIA come from the primitive; closing it without a
 * successful verify is treated as abandonment by the caller. It renders two faces: the OTP entry (with
 * its wrong-code, expired, and resend states) and — when the request never reached the server — a
 * distinct "connection lost" recovery that is deliberately not an authentication-failure message
 * (AC-04 vs AC-07).
 */
export function StepUpChallengeModal({
  open,
  onOpenChange,
  controller,
}: StepUpChallengeModalProps) {
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

  const isNetwork = errorKind === 'network';
  const otpState = errorKind === 'incorrect' || errorKind === 'locked' ? 'error' : 'default';
  const altMethod = method === 'otp_sms' ? 'otp_email' : 'otp_sms';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content className="bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 text-center shadow-2xl">
          {isNetwork ? (
            <>
              <div className="bg-cl-warn-weak mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl">
                <Icon name="triangle-alert" size={21} className="text-cl-warn" />
              </div>
              <Dialog.Title asChild>
                <Text as="h2" size="heading" tone="default" className="mb-1.5">
                  Connection lost
                </Text>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Text as="p" size="label" tone="muted" className="mb-4 leading-relaxed">
                  {messageForStepUpError('network')}
                </Text>
              </Dialog.Description>
              <div className="flex gap-2.25">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <Button
                  className="flex-[1.5]"
                  fullWidth
                  loading={isVerifying}
                  onClick={() => submit()}
                >
                  Try again
                </Button>
              </div>
              <Text as="p" size="mono" tone="faint" className="mt-3">
                payment flow position preserved
              </Text>
            </>
          ) : (
            <>
              <div className="bg-cl-accent-weak mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
                <Icon name="shield" size={20} className="text-cl-accent-text" />
              </div>
              <Dialog.Title asChild>
                <Text as="h2" size="heading" tone="default" className="mb-1">
                  Verify it&apos;s you
                </Text>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Text as="p" size="label" tone="muted" className="mb-4 leading-relaxed">
                  Enter the {otpLength}-digit code sent to {destinationMasked}. Required for
                  transfers over {thresholdLabel}.
                </Text>
              </Dialog.Description>

              {/* In this branch a network failure has its own face, so any errorKind here is an
                  entry-state notice (wrong code, expired, or locked). */}
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
                {/* AC-04: an alternative method is offered the moment a code is rejected, without
                    waiting out the resend timer. */}
                {errorKind === 'incorrect' && !resendReady ? (
                  <Button variant="link" onClick={() => requestResend(altMethod)}>
                    Use a different method
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
