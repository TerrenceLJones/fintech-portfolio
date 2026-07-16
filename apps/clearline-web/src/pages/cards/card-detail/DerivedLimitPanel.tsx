import type { Money } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';
import { MoneyDisplay, Text, formatMoneyValue } from '@clearline/ui';

export interface DerivedLimitPanelProps {
  monthlyLimit: Money;
  remainingMinorUnits: number;
  allowedMccs: string[];
}

/** Prettifies an MCC code into its label, e.g. 'office_supplies' → 'Office Supplies'. */
function mccLabel(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The derived remaining-limit panel (US-CW-014 AC-02). The big figure carries the "DERIVED · READ-ONLY"
 * lock chip so it never reads as editable, with a progress bar of spend against the monthly limit and
 * the card's MCC restriction chips.
 */
export function DerivedLimitPanel({
  monthlyLimit,
  remainingMinorUnits,
  allowedMccs,
}: DerivedLimitPanelProps) {
  const remaining = { amountMinorUnits: remainingMinorUnits, currency: monthlyLimit.currency };
  const spentMinor = Math.max(0, monthlyLimit.amountMinorUnits - remainingMinorUnits);
  const spentFraction =
    monthlyLimit.amountMinorUnits > 0 ? spentMinor / monthlyLimit.amountMinorUnits : 0;

  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
      <div className="mb-2 flex items-center justify-between">
        <MoneyDisplay amount={toMajorUnits(remaining)} derived />
        <Text as="span" size="mono" tone="faint">
          of {formatMoneyValue(monthlyLimit)}
        </Text>
      </div>
      <Text as="div" size="label" tone="faint" className="mb-2">
        remaining this month
      </Text>
      <div className="bg-cl-surface-2 h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="bg-cl-accent h-full rounded-full"
          style={{ width: `${Math.min(100, Math.round(spentFraction * 100))}%` }}
        />
      </div>
      {allowedMccs.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {allowedMccs.map((code) => (
            <span
              key={code}
              className="border-cl-border bg-cl-surface-2 text-cl-text-2 rounded-md border px-2.25 py-1 text-[11px]"
            >
              {mccLabel(code)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
