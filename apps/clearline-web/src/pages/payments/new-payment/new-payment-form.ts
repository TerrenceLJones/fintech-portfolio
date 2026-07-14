import type { Money, PaymentErrorCode } from '@clearline/contracts';
import { currencySymbol } from '@clearline/money';
import { formatMoneyValue } from '@clearline/ui';

/**
 * Maps a payment rejection reason to the exact user-facing copy from the design (US-CW-008/009). The
 * balance/limit variants fold in the server-echoed amount so the message is specific ("Available:
 * $3,000.00."); the zero-amount prompt uses the source `currency`'s symbol so it reads correctly for
 * a non-USD account. No message ever exposes compliance terminology.
 */
export function messageForPaymentError(
  reason: PaymentErrorCode,
  detail: { availableBalance?: Money; dailyLimit?: Money; currency?: string } = {},
): string {
  switch (reason) {
    case 'invalid_amount':
      return `Enter an amount greater than ${currencySymbol(detail.currency ?? 'USD')}0.`;
    case 'insufficient_balance':
      return `You don't have enough available balance for this transfer.${
        detail.availableBalance ? ` Available: ${formatMoneyValue(detail.availableBalance)}.` : ''
      }`;
    case 'daily_limit_exceeded':
      return `This exceeds your daily transfer limit${
        detail.dailyLimit ? ` of ${formatMoneyValue(detail.dailyLimit)}` : ''
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
