import { Button, Icon, Text, formatMoneyValue } from '@clearline/ui';
import { ABANDONED_MESSAGE } from './step-up-messages';

interface StepUpAbandonedBannerProps {
  recipientName: string;
  recipientMasked: string;
  amountMinor: number;
  currency: string;
  /** The idempotency key preserved across the whole flow — shown, abbreviated, to make AC-03 visible. */
  idempotencyKey: string;
  onRetry: () => void;
}

/**
 * Shown on the payment screen after a step-up challenge is closed without completing (US-CW-010 AC-03).
 * The PaymentIntent is still `requires_action` and no charge was created; "Retry verification" reopens
 * the challenge against the very same reserved intent — same idempotency key — so the retry can never
 * become a second payment.
 */
export function StepUpAbandonedBanner({
  recipientName,
  recipientMasked,
  amountMinor,
  currency,
  idempotencyKey,
  onRetry,
}: StepUpAbandonedBannerProps) {
  return (
    <div className="mt-4">
      <div className="bg-cl-warn-weak mb-3.5 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--cl-warn)_26%,transparent)] px-3.5 py-3">
        <Icon name="triangle-alert" size={16} className="text-cl-warn mt-0.25 flex-shrink-0" />
        <Text as="p" size="label" weight="semibold" className="text-cl-warn leading-relaxed">
          {ABANDONED_MESSAGE}
        </Text>
      </div>

      <div className="border-cl-border bg-cl-surface mb-3.5 rounded-xl border p-4">
        <div className="border-cl-border flex justify-between border-b py-1.5">
          <Text as="span" size="label" tone="muted">
            Recipient
          </Text>
          <Text as="span" size="label" weight="medium">
            {recipientName} · {recipientMasked}
          </Text>
        </div>
        <div className="flex justify-between pt-2">
          <Text as="span" size="label" tone="muted">
            Amount
          </Text>
          <Text as="span" size="body" weight="semibold" className="font-mono tabular-nums">
            {formatMoneyValue({ amountMinorUnits: amountMinor, currency })}
          </Text>
        </div>
      </div>

      <Button fullWidth icon="refresh" onClick={onRetry}>
        Retry verification
      </Button>
      <Text as="p" size="mono" tone="faint" className="mt-2.75 text-center">
        same key {idempotencyKey.slice(0, 8)}… preserved
      </Text>
    </div>
  );
}
