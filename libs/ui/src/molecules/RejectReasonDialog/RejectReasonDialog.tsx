import { useId, useState } from 'react';
import { Text } from '../../atoms/Text';
import { Button } from '../../atoms/Button';
import { Modal } from '../Modal';

export interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * How many expenses are being rejected. 1 (the default) renders the single-expense copy (§6.2);
   * more than 1 renders the batch "Reject N expenses · one shared reason" copy (§7.3).
   */
  count?: number;
  /** One-tap preset reasons shown as selectable chips above the free-text box. */
  presets?: string[];
  /** Called with the entered reason when the approver confirms. Never called with an empty reason. */
  onConfirm: (reason: string) => void;
  /** Disables the confirm button while the reject request is in flight. */
  submitting?: boolean;
}

/**
 * The reason capture for rejecting an expense — a required free-text reason (US-CW-012 AC-02) with
 * optional one-tap presets. The reason travels back to the submitter, so the confirm button stays
 * disabled until a non-empty reason is entered. Handles both the single-expense reject (§6.2) and the
 * batch "one shared reason, each submitter notified individually" reject (§7.3) via `count`.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  count = 1,
  presets = [],
  onConfirm,
  submitting = false,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const reasonFieldId = useId();

  // Clear the reason on each open transition so a prior draft never leaks into the next rejection.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setReason('');
  }

  const isBatch = count > 1;
  const title = isBatch ? `Reject ${count} expenses` : 'Reject expense';
  const confirmLabel = isBatch ? `Reject ${count} expenses` : 'Reject expense';
  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" tone="default">
          {title}
        </Text>
      </Modal.Title>
      {isBatch ? (
        <Modal.Description asChild>
          <Text as="p" size="label" tone="muted" className="mt-1 mb-3.5">
            This reason will be attached to each one. Employees are notified individually.
          </Text>
        </Modal.Description>
      ) : (
        <div className="mb-3.5" />
      )}

      <label htmlFor={reasonFieldId}>
        <Text as="span" size="label" weight="medium" tone="muted" className="mb-2 block">
          {isBatch ? 'Shared reason' : 'Reason for rejection'}{' '}
          <Text as="span" size="label" tone="critical">
            required
          </Text>
        </Text>
      </label>

      {presets.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const selected = trimmed === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => setReason(preset)}
                className={[
                  'rounded-md px-2.25 py-1 text-[11px] font-medium',
                  selected
                    ? 'bg-cl-accent-weak text-cl-accent-text'
                    : 'bg-cl-surface-2 text-cl-text-2',
                ].join(' ')}
              >
                {preset}
              </button>
            );
          })}
        </div>
      ) : null}

      <textarea
        id={reasonFieldId}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        className="border-cl-border-2 bg-cl-surface text-cl-text-2 mb-4 min-h-14 w-full rounded-lg border px-3 py-2.5 text-[12.5px]"
        placeholder="Add a short reason the employee will see…"
      />

      <div className="flex gap-2.5">
        <Modal.Close asChild>
          <button
            type="button"
            className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
          >
            Cancel
          </button>
        </Modal.Close>
        <Button
          variant="danger"
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onConfirm(trimmed)}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
