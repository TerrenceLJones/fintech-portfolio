import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { normalizePaymentStatus } from '@clearline/domain-payments';
import { toMajorUnits } from '@clearline/money';
import { EmptyState, StatusBadge, Text, formatMoney } from '@clearline/ui';
import { usePaymentIntent } from '@clearline/data-access-payments';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { paymentStatusDisplay } from './payment-status-display';
import { buildPaymentStatusBeacon } from './PaymentStatusPage.beacon';

/** Formats an ISO date (or an already-friendly string) to a readable "Jul 8, 2026". */
function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Transaction detail / status view for a single payment (US-CW-007 AC-03, US-CW-009). The raw server
 * status is normalized: an unrecognized code degrades to a neutral "Processing" (never a guess), and a
 * compliance hold reads as "Pending review" with no screening terminology. While the status is still
 * settling the view polls for the definitive outcome; a reversal shows its date and that funds were
 * returned. The unrecognized raw status is logged for engineering, never shown to the user.
 */
export function PaymentStatusPage() {
  usePageTitle('Payment');
  const { intentId = '' } = useParams();

  const queryClient = useQueryClient();
  useDemoBeacon(
    useMemo(() => buildPaymentStatusBeacon(intentId, queryClient), [intentId, queryClient]),
  );

  const query = usePaymentIntent(intentId, {
    enabled: !!intentId,
    refetchInterval: (q) => {
      const status = q.state.data?.intent.status;
      if (!status) return false;
      const { status: normalized } = normalizePaymentStatus(status);
      return paymentStatusDisplay(normalized).isSettling ? 2500 : false;
    },
  });

  const intent = query.data?.intent;
  const rawStatus = intent?.status;

  // Log an unrecognized status once per (intent, status) for engineering triage — in an effect, not
  // during render, so it doesn't re-fire on every poll tick or double-log under StrictMode.
  useEffect(() => {
    if (!rawStatus) return;
    if (!normalizePaymentStatus(rawStatus).recognized) {
      console.warn(`Unrecognized payment status "${rawStatus}" for ${intentId}`);
    }
  }, [intentId, rawStatus]);

  if (query.isPending) {
    return (
      <Text as="p" size="label" tone="muted">
        Loading payment…
      </Text>
    );
  }

  if (!intent) {
    return (
      <EmptyState
        icon="search"
        title="Payment not found"
        body="We couldn't find that payment. Check the link and try again."
      />
    );
  }

  // An unrecognized status was already degraded to a neutral "Processing" by normalizePaymentStatus
  // (US-CW-009 AC-03) — the raw value is logged in the effect above, never shown to the user.
  const normalized = normalizePaymentStatus(intent.status);
  const display = paymentStatusDisplay(normalized.status, {
    reversedDate: intent.reversedDate ? formatDate(intent.reversedDate) : undefined,
  });

  return (
    <div className="font-sans">
      <div className="mx-auto max-w-[520px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Text as="div" size="body" weight="semibold">
              {intent.recipientName}
            </Text>
            <Text as="div" size="label" tone="faint">
              {intent.method.toUpperCase()} · {intent.recipientMasked}
            </Text>
          </div>
          <StatusBadge status={display.badgeStatus} label={display.label} />
        </div>

        <Text as="div" size="mono" weight="semibold" className="mb-4 text-2xl">
          {formatMoney(toMajorUnits(intent.amount), intent.amount.currency)}
        </Text>

        <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
          <Text as="p" size="label" tone="muted" className="mb-0">
            {display.description}
          </Text>
        </div>
      </div>
    </div>
  );
}
