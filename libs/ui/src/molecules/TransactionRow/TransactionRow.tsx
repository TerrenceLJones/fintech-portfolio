import { formatMoney } from '../../utils/formatMoney';

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
      <div
        className={[
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
          live ? 'bg-cl-surface text-cl-text' : 'bg-cl-surface-2 text-cl-text-2',
        ].join(' ')}
      >
        {(initials ?? merchant.slice(0, 2)).slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-cl-text truncate text-[12.5px] font-semibold">{merchant}</div>
        <div className="text-cl-text-3 text-[10.5px]">
          {category} &middot; {time}
        </div>
      </div>
      <div className="text-cl-text font-mono flex-shrink-0 text-[13px] font-semibold tabular-nums">
        {formatMoney(amount)}
      </div>
    </div>
  );
}
