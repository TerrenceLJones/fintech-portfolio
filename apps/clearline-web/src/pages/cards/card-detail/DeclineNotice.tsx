import type { CardTransaction } from '@clearline/contracts';
import { cardholderDeclineMessage } from '@clearline/domain-cards';
import { Icon, Text } from '@clearline/ui';

export interface DeclineNoticeProps {
  transaction: CardTransaction;
}

/**
 * The cardholder-facing notification for a declined authorization (US-CW-014 AC-03/AC-04/AC-07). The
 * message is produced by the security gate `cardholderDeclineMessage`: an MCC or limit decline states
 * its specific reason, while a card reported lost/stolen/fraudulent shows the identical generic
 * message — the true reason is never revealed to the cardholder here.
 */
export function DeclineNotice({ transaction }: DeclineNoticeProps) {
  const message = cardholderDeclineMessage(transaction.declineReason ?? 'mcc_restricted');

  return (
    <div className="bg-cl-text flex items-start gap-3 rounded-xl p-4" role="status">
      <span className="bg-cl-surface/15 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white">
        <Icon name="x-circle" size={18} />
      </span>
      <div>
        <Text as="div" size="label" className="text-white/70">
          Clearline
        </Text>
        <Text as="div" size="label" weight="semibold" className="text-white">
          {message}
        </Text>
      </div>
    </div>
  );
}
