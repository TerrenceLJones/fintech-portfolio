import { Icon } from '@fintech-portfolio/icons';
import { formatMoney } from '../lib/format-money';

export type MoneyState = 'loaded' | 'loading' | 'credit' | 'debit';

export interface MoneyDisplayProps {
  amount: number;
  state?: MoneyState;
  label?: string;
  /** Shows the "DERIVED · READ-ONLY" chip — for values that are ledger projections, never editable inputs. */
  derived?: boolean;
}

export function MoneyDisplay({
  amount,
  state = 'loaded',
  label,
  derived = false,
}: MoneyDisplayProps) {
  let main: React.ReactNode;

  if (state === 'loading') {
    main = <div className="cl-skeleton h-[30px] w-[130px] rounded-md" aria-hidden="true" />;
  } else if (state === 'credit' || state === 'debit') {
    const positive = state === 'credit';
    main = (
      <div
        className={`flex items-center gap-1 font-mono text-2xl font-semibold tabular-nums ${positive ? 'text-cl-pos' : 'text-cl-neg'}`}
      >
        <Icon name={positive ? 'arrow-up' : 'arrow-down'} size={15} />
        {formatMoney(amount)}
      </div>
    );
  } else {
    main = (
      <div className="text-cl-text font-mono text-2xl font-semibold tracking-tight tabular-nums">
        {formatMoney(amount)}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {main}
      {derived ? (
        <span className="text-cl-text-3 border-cl-border-2 mt-2 inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10.5px]">
          <Icon name="lock" size={11} />
          DERIVED &middot; READ-ONLY
        </span>
      ) : label ? (
        <div className="text-cl-text-3 mt-1.5 text-[11.5px]">{label}</div>
      ) : null}
    </div>
  );
}
