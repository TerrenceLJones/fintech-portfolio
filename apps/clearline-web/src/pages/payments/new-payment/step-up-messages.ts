/**
 * The distinct failure modes of a step-up challenge (US-CW-010). Kept as separate kinds — rather than
 * one generic "error" — because the whole point of AC-04/AC-06/AC-07 is that a wrong code, an expired
 * code, and a dropped connection must read differently to the user (and to monitoring): a fraud-relevant
 * auth failure is not an infrastructure failure.
 */
export type StepUpErrorKind = 'incorrect' | 'expired' | 'network' | 'locked';

/** The exact user-facing copy for each step-up failure, matching the design system's §5 screens. */
export function messageForStepUpError(kind: StepUpErrorKind): string {
  switch (kind) {
    case 'incorrect':
      return "We couldn't verify your identity. Try again or use a different verification method.";
    case 'expired':
      return "That code expired. We've sent a new one.";
    case 'network':
      return 'We lost connection during verification. Try again.';
    case 'locked':
      return 'Too many attempts. For your security, request a new code to continue.';
  }
}

/** The banner shown back on the payment screen after a challenge is abandoned (US-CW-010 AC-03). */
export const ABANDONED_MESSAGE =
  "Authentication wasn't completed. Try again to finish your payment.";
