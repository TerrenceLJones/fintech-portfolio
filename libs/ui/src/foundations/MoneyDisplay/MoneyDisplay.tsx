import { Icon } from '../Icon';
import { formatMoney } from '../../utils/formatMoney';
import { spokenMoneyAmount } from '@clearline/money';
import { Text } from '../../atoms/Text';

export type MoneyState = 'loaded' | 'loading' | 'credit' | 'debit';

export interface MoneyDisplayProps {
  amount: number;
  state?: MoneyState;
  label?: string;
  /** ISO 4217 code used for both the formatted glyphs and the spoken aria-label. @default 'USD' */
  currency?: string;
  /** Overrides the auto-generated spoken screen-reader phrase (e.g. to add surrounding context). */
  ariaLabel?: string;
  /** Shows the "DERIVED · READ-ONLY" chip — for values that are ledger projections, never editable inputs. */
  derived?: boolean;
}

export function MoneyDisplay({
  amount,
  state = 'loaded',
  label,
  currency = 'USD',
  ariaLabel,
  derived = false,
}: MoneyDisplayProps) {
  let main: React.ReactNode;

  if (state === 'loading') {
    main = <div className="cl-skeleton h-[30px] w-[130px] rounded-md" aria-hidden="true" />;
  } else if (state === 'credit' || state === 'debit') {
    const positive = state === 'credit';
    main = (
      <div
        aria-hidden="true"
        className={`flex items-center gap-1 font-mono text-2xl font-semibold tabular-nums ${positive ? 'text-cl-pos' : 'text-cl-neg'}`}
      >
        <Icon name={positive ? 'arrow-up' : 'arrow-down'} size={15} />
        {formatMoney(amount, currency)}
      </div>
    );
  } else {
    main = (
      <div
        aria-hidden="true"
        className="text-cl-text font-mono text-2xl font-semibold tracking-tight tabular-nums"
      >
        {formatMoney(amount, currency)}
      </div>
    );
  }

  // Screen readers get the fully spoken amount as real (visually hidden) text rather than the raw
  // "$1,999.00" glyphs above, which are marked aria-hidden so the value is announced exactly once.
  // Credit/debit direction — otherwise carried only by an arrow icon and color — is spoken too.
  const spoken =
    state === 'loading'
      ? null
      : (ariaLabel ??
        (state === 'credit'
          ? `Credit of ${spokenMoneyAmount(amount, currency)}`
          : state === 'debit'
            ? `Debit of ${spokenMoneyAmount(amount, currency)}`
            : spokenMoneyAmount(amount, currency)));

  return (
    <div className="flex flex-col items-start">
      {main}
      {spoken ? <span className="sr-only">{spoken}</span> : null}
      {derived ? (
        <span className="text-cl-text-3 border-cl-border-2 mt-2 inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5">
          <Icon name="lock" size={11} />
          <Text as="span" size="mono" tone="faint">
            DERIVED &middot; READ-ONLY
          </Text>
        </span>
      ) : label ? (
        <Text as="div" size="label" weight="regular" tone="faint" className="mt-1.5">
          {label}
        </Text>
      ) : null}
    </div>
  );
}
