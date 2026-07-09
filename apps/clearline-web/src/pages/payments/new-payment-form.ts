import type { Money, PaymentErrorCode } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';
import { formatMoney } from '@clearline/ui';

/**
 * Parses a user-typed dollar amount into USD minor units (cents), tolerating `$`, commas and
 * surrounding whitespace. Returns null for anything that isn't a positive number, so the form can
 * keep the submit blocked without a network call.
 */
export function parseAmountToMinorUnits(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}

function formatMoneyAmount(money: Money): string {
  return formatMoney(toMajorUnits(money), money.currency);
}

/**
 * Maps a payment rejection reason to the exact user-facing copy from the design (US-CW-008/009). The
 * balance/limit variants fold in the server-echoed amount so the message is specific ("Available:
 * $3,000.00."). No message ever exposes compliance terminology.
 */
export function messageForPaymentError(
  reason: PaymentErrorCode,
  detail: { availableBalance?: Money; dailyLimit?: Money } = {},
): string {
  switch (reason) {
    case 'insufficient_balance':
      return `You don't have enough available balance for this transfer.${
        detail.availableBalance ? ` Available: ${formatMoneyAmount(detail.availableBalance)}.` : ''
      }`;
    case 'daily_limit_exceeded':
      return `This exceeds your daily transfer limit${
        detail.dailyLimit ? ` of ${formatMoneyAmount(detail.dailyLimit)}` : ''
      }. Request a higher limit or enter a smaller amount.`;
    case 'recipient_not_found':
      return "We couldn't find that recipient account. Check the details and try again.";
    case 'recipient_closed':
      return "This recipient's account is no longer active. Contact them to get updated details.";
    case 'self_transfer':
      return "You can't transfer to the same account.";
    case 'idempotency_mismatch':
      return 'Something changed since your last attempt — resubmitting as a new payment.';
    case 'forbidden':
    default:
      return "You don't have permission to make payments.";
  }
}
