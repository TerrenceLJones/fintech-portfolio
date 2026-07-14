import type { PaymentIntent, StepUpChallenge as StepUpChallengeData } from '@clearline/contracts';
import { StepUpChallengeModal } from './StepUpChallengeModal';
import { useStepUpChallenge } from './use-step-up-challenge';

interface StepUpChallengeProps {
  challenge: StepUpChallengeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (intent: PaymentIntent) => void;
}

/**
 * Thin container that owns the challenge state hook and feeds it to the presentational modal — mounted
 * only while a reserved payment awaits step-up, so the OTP mutations and timer live exactly as long as
 * the challenge does (US-CW-010).
 */
export function StepUpChallenge({
  challenge,
  open,
  onOpenChange,
  onVerified,
}: StepUpChallengeProps) {
  const controller = useStepUpChallenge({ challenge, open, onVerified });
  return <StepUpChallengeModal open={open} onOpenChange={onOpenChange} controller={controller} />;
}
