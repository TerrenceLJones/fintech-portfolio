import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Icon } from '@fintech-portfolio/icons';

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content className="bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl">
          <div className="mb-3 flex items-center gap-2.75">
            <div className="bg-cl-warn-weak flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
              <Icon name="triangle-alert" size={17} className="text-cl-warn" />
            </div>
            <Dialog.Title className="text-cl-text text-[15px] font-semibold">{title}</Dialog.Title>
          </div>
          {body ? (
            <Dialog.Description className="text-cl-text-2 mb-3.5 text-[12.5px] leading-relaxed">
              {body}
            </Dialog.Description>
          ) : null}
          <div
            aria-live="polite"
            className="text-cl-crit bg-cl-crit-weak font-mono mb-4 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
          >
            IRREVERSIBLE &middot; NO UNDO
          </div>
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
              disabled={!armed}
              onClick={onConfirm}
              className={`bg-cl-accent flex-[1.4] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white ${armed ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
            >
              {armed ? confirmLabel : `Confirm in ${secondsLeft}…`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
