import { Button, Icon, Modal, Text } from '@clearline/ui';
import { messageForStepUpError } from './step-up-messages';

interface StepUpConnectionLostProps {
  isVerifying: boolean;
  onRetry: () => void;
}

/**
 * The step-up modal's "connection lost" face (US-CW-010 AC-07): a mid-challenge connectivity failure,
 * worded and iconed distinctly from a wrong-code authentication failure, with a retry that resubmits
 * the same code without losing the payment's place.
 */
export function StepUpConnectionLost({ isVerifying, onRetry }: StepUpConnectionLostProps) {
  return (
    <>
      <div className="bg-cl-warn-weak mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl">
        <Icon name="triangle-alert" size={21} className="text-cl-warn" />
      </div>
      <Modal.Title asChild>
        <Text as="h2" size="heading" tone="default" className="mb-1.5">
          Connection lost
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" size="label" tone="muted" className="mb-4 leading-relaxed">
          {messageForStepUpError('network')}
        </Text>
      </Modal.Description>
      <div className="flex gap-2.25">
        <Modal.Close asChild>
          <button
            type="button"
            className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
          >
            Cancel
          </button>
        </Modal.Close>
        <Button className="flex-[1.5]" fullWidth loading={isVerifying} onClick={onRetry}>
          Try again
        </Button>
      </div>
      <Text as="p" size="mono" tone="faint" className="mt-3">
        payment flow position preserved
      </Text>
    </>
  );
}
