import { formatMoney } from '../../utils/formatMoney';
import { Text } from '../../atoms/Text';

export type TransactionRowState = 'default' | 'live' | 'dim';

export interface TransactionRowProps {
  merchant: string;
  category: string;
  time: string;
  amount: number;
  initials?: string;
  state?: TransactionRowState;
}

export function TransactionRow({
  merchant,
  category,
  time,
  amount,
  initials,
  state = 'default',
}: TransactionRowProps) {
  const live = state === 'live';
  const dim = state === 'dim';

  return (
    <div
      className={[
        'flex items-center gap-3 px-3 py-2.75 font-sans',
        live ? 'bg-cl-pos-weak border-cl-pos/30 rounded-lg border' : 'border-cl-border border-b',
        dim ? 'opacity-70' : '',
      ].join(' ')}
    >
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
      <div className="min-w-0 flex-1">
        <Text as="div" size="label" weight="semibold" tone="default" className="truncate">
          {merchant}
        </Text>
        <Text as="div" size="label" weight="regular" tone="faint">
          {category} &middot; {time}
        </Text>
      </div>
      <Text as="div" size="mono" weight="semibold" tone="default" className="flex-shrink-0">
        {formatMoney(amount)}
      </Text>
    </div>
  );
}
