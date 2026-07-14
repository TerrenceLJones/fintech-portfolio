import { useEffect, useState } from 'react';
import type { PaymentIntent, StepUpChallenge, StepUpMethod } from '@clearline/contracts';
import {
  StepUpAuthError,
  StepUpExpiredError,
  StepUpLockedError,
  useResendStepUp,
  useVerifyStepUp,
} from '@clearline/data-access-payments';
import type { StepUpErrorKind } from './step-up-messages';

/** Seconds before the "Resend" / "Try another method" affordances activate (US-CW-010 AC-05). */
export const RESEND_DELAY_SECONDS = 30;
const OTP_LENGTH = 6;

interface UseStepUpChallengeArgs {
  /** The initial challenge from the create response, or the one being retried after abandonment. */
  challenge: StepUpChallenge;
  /** Whether the challenge modal is currently shown — a closed→open transition is a fresh Retry. */
  open?: boolean;
  /** Called with the committed intent once the correct code verifies (AC-02). */
  onVerified: (intent: PaymentIntent) => void;
  /** Override the resend delay in tests. */
  resendDelaySeconds?: number;
}

/**
 * Drives one step-up challenge to resolution (US-CW-010). Owns the entered code, the 30-second timer
 * that gates resend/alternative-method (AC-05), and the mapping of each verify failure to a distinct
 * kind — wrong code (AC-04), expired-and-reissued (AC-06), lockout, and connectivity loss (AC-07) —
 * kept apart so the modal renders the right, non-interchangeable message. An expired code seamlessly
 * swaps in the fresh challenge the server issued; a successful verify hands the committed intent up.
 */
export function useStepUpChallenge({
  challenge,
  open = true,
  onVerified,
  resendDelaySeconds = RESEND_DELAY_SECONDS,
}: UseStepUpChallengeArgs) {
  const [current, setCurrent] = useState<StepUpChallenge>(challenge);
  const [code, setCode] = useState('');
  const [errorKind, setErrorKind] = useState<StepUpErrorKind | null>(null);
  const [secondsToResend, setSecondsToResend] = useState(resendDelaySeconds);

  const verify = useVerifyStepUp(current.intentId);
  const resend = useResendStepUp(current.intentId);

  function reset(next: StepUpChallenge) {
    setCurrent(next);
    setCode('');
    setErrorKind(null);
    setSecondsToResend(resendDelaySeconds);
  }

  // Reset to a clean slate on either a brand-new reservation (challenge identity changes) or a
  // closed→open transition — reopening on "Retry verification" should never show the prior attempt's
  // red cells or stale digits, and re-arms the resend timer.
  const [seenIntentId, setSeenIntentId] = useState(challenge.intentId);
  const [prevOpen, setPrevOpen] = useState(open);
  if (challenge.intentId !== seenIntentId) {
    setSeenIntentId(challenge.intentId);
    reset(challenge);
  } else if (open && !prevOpen) {
    reset(current);
  }
  if (open !== prevOpen) setPrevOpen(open);

  // Count down to the resend/alternative-method affordances. Re-armed whenever a new code is issued
  // (initial, resend, or post-expiry) by resetting `secondsToResend` back to the full delay.
  useEffect(() => {
    if (secondsToResend <= 0) return;
    const timer = window.setTimeout(() => setSecondsToResend((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsToResend]);

  function armFreshCode(next: StepUpChallenge) {
    setCurrent(next);
    setCode('');
    setSecondsToResend(resendDelaySeconds);
  }

  // `override` lets auto-submit pass the just-completed code directly, since the `code` state hasn't
  // re-rendered yet when OtpInput fires onComplete.
  function submit(override?: string) {
    const value = override ?? code;
    if (value.length !== OTP_LENGTH || verify.isPending) return;
    verify.mutate(value, {
      onSuccess: onVerified,
      onError: (error) => {
        if (error instanceof StepUpExpiredError) {
          // The server already invalidated the old code and issued a new one (AC-06) — swap it in.
          armFreshCode(error.challenge);
          setErrorKind('expired');
          return;
        }
        if (error instanceof StepUpAuthError) {
          setErrorKind('incorrect');
          return;
        }
        if (error instanceof StepUpLockedError) {
          setErrorKind('locked');
          return;
        }
        // Anything else is a connectivity-class failure — distinct from a wrong code (AC-07).
        setErrorKind('network');
      },
    });
  }

  function changeCode(next: string) {
    setCode(next);
    // Editing after a wrong/locked attempt clears the red state so the retry starts clean; the expiry
    // notice is left up until the user submits the fresh code.
    if (errorKind === 'incorrect' || errorKind === 'locked' || errorKind === 'network') {
      setErrorKind(null);
    }
  }

  function requestResend(method?: StepUpMethod) {
    resend.mutate(method, {
      onSuccess: (next) => {
        armFreshCode(next);
        setErrorKind(null);
      },
    });
  }

  return {
    intentId: current.intentId,
    destinationMasked: current.destinationMasked,
    method: current.method,
    code,
    changeCode,
    submit,
    onComplete: submit,
    requestResend,
    errorKind,
    isVerifying: verify.isPending,
    isResending: resend.isPending,
    // The resend/alternative-method links activate only once the timer elapses (AC-05).
    resendReady: secondsToResend <= 0,
    secondsToResend,
    otpLength: OTP_LENGTH,
  };
}

export type StepUpChallengeController = ReturnType<typeof useStepUpChallenge>;
