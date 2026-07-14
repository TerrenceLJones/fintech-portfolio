import { Modal } from '@clearline/ui';
import { StepUpChallengeEntry } from './StepUpChallengeEntry';
import { StepUpConnectionLost } from './StepUpConnectionLost';
import type { StepUpChallengeController } from './use-step-up-challenge';

interface StepUpChallengeModalProps {
  open: boolean;
  /** Closing the modal without verifying is an abandonment (US-CW-010 AC-03). */
  onOpenChange: (open: boolean) => void;
  controller: StepUpChallengeController;
}

/**
 * The step-up (3DS-style) challenge overlay for a high-value payment (US-CW-010). Built on the shared
 * `Modal` (focus-trap, Escape-to-close and ARIA), it picks between two faces: the OTP entry (with
 * its wrong-code, expired, and resend states) and — when the request never reached the server — a
 * distinct "connection lost" recovery that is deliberately not an authentication-failure message
 * (AC-04 vs AC-07). Closing it without a successful verify is treated as abandonment by the caller.
 */
export function StepUpChallengeModal({
  open,
  onOpenChange,
  controller,
}: StepUpChallengeModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={340} className="text-center">
      {controller.errorKind === 'network' ? (
        <StepUpConnectionLost
          isVerifying={controller.isVerifying}
          onRetry={() => controller.submit()}
        />
      ) : (
        <StepUpChallengeEntry controller={controller} />
      )}
    </Modal>
  );
}
