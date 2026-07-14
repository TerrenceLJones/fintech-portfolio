import type { ReactNode } from 'react';
import { Icon } from '../../foundations/Icon';
import type { IconName } from '@clearline/icons';
import { Text } from '../../atoms/Text';
import { Modal } from '../Modal';

export type AlertModalTone = 'accent' | 'negative' | 'warning';

const TONE_CLASSES: Record<AlertModalTone, { weakBg: string; fg: string; solidBg: string }> = {
  accent: { weakBg: 'bg-cl-accent-weak', fg: 'text-cl-accent-text', solidBg: 'bg-cl-accent' },
  negative: { weakBg: 'bg-cl-neg-weak', fg: 'text-cl-neg', solidBg: 'bg-cl-neg' },
  warning: { weakBg: 'bg-cl-warn-weak', fg: 'text-cl-warn', solidBg: 'bg-cl-accent' },
};

export interface AlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: IconName;
  title: string;
  body?: ReactNode;
  tone?: AlertModalTone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

/** A contained, focus-trapped overlay built on the shared `Modal` primitive (focus trap, Escape-to-close, and ARIA wiring come from the primitive rather than being hand-rolled). */
export function AlertModal({
  open,
  onOpenChange,
  icon = 'arrow-right',
  title,
  body,
  tone = 'accent',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
}: AlertModalProps) {
  const t = TONE_CLASSES[tone];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <div className="mb-3 flex items-center gap-2.75">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${t.weakBg}`}
        >
          <Icon name={icon} size={17} className={t.fg} />
        </div>
        <Modal.Title asChild>
          <Text as="h2" size="heading" tone="default">
            {title}
          </Text>
        </Modal.Title>
      </div>
      {body ? (
        <Modal.Description asChild>
          <Text as="p" size="label" weight="regular" tone="muted" className="mb-4">
            {body}
          </Text>
        </Modal.Description>
      ) : null}
      <div className="flex gap-2.5">
        <Modal.Close asChild>
          <button
            type="button"
            className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
          >
            {cancelLabel}
          </button>
        </Modal.Close>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-[1.4] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white ${t.solidBg}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
