import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Icon, type IconName } from '@fintech-portfolio/icons';
import { Text } from '../../atoms/Text';

export type ModalTone = 'accent' | 'negative' | 'warning';

const TONE_CLASSES: Record<ModalTone, { weakBg: string; fg: string; solidBg: string }> = {
  accent: { weakBg: 'bg-cl-accent-weak', fg: 'text-cl-accent-text', solidBg: 'bg-cl-accent' },
  negative: { weakBg: 'bg-cl-neg-weak', fg: 'text-cl-neg', solidBg: 'bg-cl-neg' },
  warning: { weakBg: 'bg-cl-warn-weak', fg: 'text-cl-warn', solidBg: 'bg-cl-accent' },
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: IconName;
  title: string;
  body?: ReactNode;
  tone?: ModalTone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

/** A contained, focus-trapped overlay built on Radix `Dialog` (focus trap, Escape-to-close, and ARIA wiring come from the primitive rather than being hand-rolled). */
export function Modal({
  open,
  onOpenChange,
  icon = 'arrow-right',
  title,
  body,
  tone = 'accent',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
}: ModalProps) {
  const t = TONE_CLASSES[tone];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content className="bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl">
          <div className="mb-3 flex items-center gap-2.75">
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${t.weakBg}`}
            >
              <Icon name={icon} size={17} className={t.fg} />
            </div>
            <Dialog.Title asChild>
              <Text as="h2" size="heading" tone="default">
                {title}
              </Text>
            </Dialog.Title>
          </div>
          {body ? (
            <Dialog.Description asChild>
              <Text as="p" size="label" weight="regular" tone="muted" className="mb-4">
                {body}
              </Text>
            </Dialog.Description>
          ) : null}
          <div className="flex gap-2.5">
            <Dialog.Close asChild>
              <button
                type="button"
                className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-[1.4] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white ${t.solidBg}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
