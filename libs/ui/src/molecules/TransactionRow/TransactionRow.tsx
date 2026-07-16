import { Icon } from '../../foundations/Icon';
import { formatMoney } from '../../utils/formatMoney';
import { Text } from '../../atoms/Text';

export type TransactionRowState = 'default' | 'live' | 'dim' | 'declined';

export interface TransactionRowProps {
  merchant: string;
  category: string;
  time: string;
  amount: number;
  initials?: string;
  state?: TransactionRowState;
  /**
   * The feed-side reason for a declined row (e.g. 'MCC restricted (Restaurants)'), shown as
   * "Declined · {reason}". Only used when `state` is 'declined' (US-CW-014 AC-03/AC-04). This is the
   * Controller-facing feed reason — the cardholder-facing message is gated separately.
   */
  declineReason?: string;
}

export function TransactionRow({
  merchant,
  category,
  time,
  amount,
  initials,
  state = 'default',
  declineReason,
}: TransactionRowProps) {
  const live = state === 'live';
  const dim = state === 'dim';
  const declined = state === 'declined';

  return (
    <div
      className={[
        'flex items-center gap-3 px-3 py-2.75 font-sans',
        live ? 'bg-cl-pos-weak border-cl-pos/30 rounded-lg border' : 'border-cl-border border-b',
        dim ? 'opacity-70' : '',
      ].join(' ')}
    >
      {declined ? (
        // A declined charge reads through an icon + red reason text + strikethrough amount — never
        // colour alone (US-CW-014 accessibility requirement).
        <div className="bg-cl-neg-weak text-cl-neg flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
          <Icon name="x-circle" size={16} />
        </div>
      ) : (
        <Text
          as="div"
          size="label"
          weight="semibold"
          className={[
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            live ? 'bg-cl-surface text-cl-text' : 'bg-cl-surface-2 text-cl-text-2',
          ].join(' ')}
        >
          {(initials ?? merchant.slice(0, 2)).slice(0, 2)}
        </Text>
      )}
      <div className="min-w-0 flex-1">
        <Text as="div" size="label" weight="semibold" tone="default" className="truncate">
          {merchant}
        </Text>
        {declined ? (
          <Text as="div" size="label" weight="regular" className="text-cl-neg truncate">
            Declined &middot; {declineReason ?? 'declined'}
          </Text>
        ) : (
          <Text as="div" size="label" weight="regular" tone="faint">
            {category} &middot; {time}
          </Text>
        )}
      </div>
      <Text
        as="div"
        size="mono"
        weight="semibold"
        tone={declined ? 'faint' : 'default'}
        className={['flex-shrink-0', declined ? 'line-through' : ''].join(' ')}
      >
        {formatMoney(amount)}
      </Text>
    </div>
  );
}
