import { useState } from 'react';
import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';
import { Button } from '../../atoms/Button';
import { Modal } from '../Modal';

export interface RevealSecretModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Copy your API key". */
  title: string;
  /** One-line context above the secret, e.g. `Key "Production — Read Only" was created.` */
  context: string;
  /** The full plaintext secret — shown here exactly once and never re-displayed (US-CW-041 AC-01/06). */
  secret: string;
  /** The bold warning banner copy, e.g. "This is the only time you'll see this key…". */
  warning: string;
  /** Confirm button label. @default "I've copied it — done" */
  confirmLabel?: string;
  /** Fired when the user dismisses the modal, having acknowledged the one-time reveal. */
  onDone: () => void;
}

/**
 * The reveal-once secret modal (design §19.3, reused for §19.5). A newly minted API key or webhook
 * signing secret is shown in full EXACTLY ONCE: a copy button, a can't-miss warning that it won't be
 * shown again, and a single acknowledge-and-close action. There is deliberately no re-open/re-reveal
 * path — a lost secret is recovered only by revoke + recreate (AC-02). Presentational: the caller owns
 * when it opens and what happens on `onDone` (typically invalidating the list so the masked form shows).
 */
export function RevealSecretModal({
  open,
  onOpenChange,
  title,
  context,
  secret,
  warning,
  confirmLabel = "I've copied it — done",
  onDone,
}: RevealSecretModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(secret);
    setCopied(true);
  };

  const done = () => {
    onDone();
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={520}>
      <div className="mb-3 flex items-center gap-2.75">
        <div className="bg-cl-accent-weak flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <Icon name="lock" size={17} className="text-cl-accent-text" />
        </div>
        <Modal.Title asChild>
          <Text as="h2" size="heading" tone="default">
            {title}
          </Text>
        </Modal.Title>
      </div>
      <Modal.Description asChild>
        <Text as="p" size="label" weight="regular" tone="muted" className="mb-3.5">
          {context}
        </Text>
      </Modal.Description>

      <div className="bg-cl-inset mb-3.5 flex items-start gap-2 rounded-lg p-3">
        <Text as="span" size="mono" tone="default" className="min-w-0 flex-1 break-all">
          {secret}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          icon="copy"
          label={copied ? 'Copied' : 'Copy'}
          onClick={copy}
          aria-label="Copy secret to clipboard"
        />
      </div>

      <div className="bg-cl-warn-weak border-cl-warn mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5">
        <Icon name="triangle-alert" size={15} className="text-cl-warn mt-0.5 shrink-0" />
        <Text as="p" size="label" weight="semibold" tone="warning">
          {warning}
        </Text>
      </div>

      <Button variant="primary" fullWidth label={confirmLabel} onClick={done} />
    </Modal>
  );
}
