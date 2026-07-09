import type { PaymentIntentStatus } from '@clearline/contracts';
import type { StatusKey } from '@clearline/ui';

export interface PaymentStatusDisplay {
  /** The shared StatusBadge key to render, with `label` overriding its default text. */
  badgeStatus: StatusKey;
  label: string;
  /** Neutral, non-alarming detail copy — never exposes compliance terminology (US-CW-009). */
  description: string;
  /** True while the definitive status isn't known yet, so the view keeps polling. */
  isSettling: boolean;
}

/**
 * Presentation for a normalized payment status. `processing` covers both an in-flight submission and
 * an unrecognized server code the client degraded (US-CW-009 AC-03) — both read as a neutral
 * "Processing" that keeps polling rather than guessing a more specific state.
 */
export function paymentStatusDisplay(
  status: PaymentIntentStatus,
  detail: { reversedDate?: string } = {},
): PaymentStatusDisplay {
  switch (status) {
    case 'pending':
      return {
        badgeStatus: 'pending-l1',
        label: 'Pending',
        description: "Processing… We'll update this as it settles. No need to resubmit.",
        isSettling: true,
      };
    case 'pending_review':
      return {
        badgeStatus: 'under-review',
        label: 'Pending review',
        description: "This transfer is under review. We'll email you once it's complete.",
        isSettling: true,
      };
    case 'settled':
      return {
        badgeStatus: 'paid',
        label: 'Settled',
        description: 'This payment has settled.',
        isSettling: false,
      };
    case 'reversed':
      return {
        badgeStatus: 'reversed',
        label: 'Reversed',
        description: detail.reversedDate
          ? `This payment was reversed on ${detail.reversedDate}. The funds were returned to your account.`
          : 'This payment was reversed. The funds were returned to your account.',
        isSettling: false,
      };
    case 'failed':
      return {
        badgeStatus: 'rejected',
        label: 'Failed',
        description: "This payment didn't go through. No funds were moved.",
        isSettling: false,
      };
    case 'processing':
    default:
      return {
        badgeStatus: 'under-review',
        label: 'Processing',
        description:
          "We're confirming the latest status with the network. This view will update automatically.",
        isSettling: true,
      };
  }
}
