import { useEffect, useId, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Icon } from '@fintech-portfolio/icons';
import { Text } from '../../atoms/Text';
import { useDisabledGuard } from '../../utils/useDisabledGuard';

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  /** Seconds the confirm button stays disabled after opening. @default 3 */
  countdown?: number;
}

/** For irreversible money-movement actions: the confirm button stays disabled and reads "Confirm in Ns…" until the countdown reaches zero. Focus-trapped and Escape-cancels via Radix `Dialog`. */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  countdown = 3,
}: ConfirmationDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdown);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset the countdown on each open transition — adjusting state during
  // render (rather than in an effect) per React's guidance for "resetting
  // state when a prop changes".
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSecondsLeft(countdown);
  }

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, secondsLeft]);

  const armed = secondsLeft <= 0;
  const countdownReasonId = useId();
  const guard = useDisabledGuard<HTMLButtonElement>(!armed, onConfirm);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content className="bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl">
          <div className="mb-3 flex items-center gap-2.75">
            <div className="bg-cl-warn-weak flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
              <Icon name="triangle-alert" size={17} className="text-cl-warn" />
            </div>
            <Dialog.Title asChild>
              <Text as="h2" size="heading" tone="default">
                {title}
              </Text>
            </Dialog.Title>
          </div>
          {body ? (
            <Dialog.Description asChild>
              <Text as="p" size="label" weight="regular" tone="muted" className="mb-3.5">
                {body}
              </Text>
            </Dialog.Description>
          ) : null}
          <Text
            as="div"
            size="mono"
            tone="critical"
            aria-live="polite"
            className="bg-cl-crit-weak mb-4 flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
          >
            IRREVERSIBLE &middot; NO UNDO
          </Text>
          <div className="flex gap-2.5">
            <Dialog.Close asChild>
              <button
                type="button"
                className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
              >
                Cancel <span className="text-cl-text-3 font-mono text-[10px]">Esc</span>
              </button>
            </Dialog.Close>
            <button
              type="button"
              aria-disabled={guard['aria-disabled']}
              aria-describedby={armed ? undefined : countdownReasonId}
              onClick={guard.onClick}
              className={`bg-cl-accent flex-[1.4] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white ${armed ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
            >
              {armed ? confirmLabel : `Confirm in ${secondsLeft}…`}
            </button>
          </div>
          {armed ? null : (
            <span id={countdownReasonId} className="sr-only">
              Waiting a few seconds before this irreversible action can be confirmed.
            </span>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
