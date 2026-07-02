import { Icon, type IconName } from '@fintech-portfolio/icons';
import { formatMoney } from '../../utils/formatMoney';

export interface BudgetGaugeProps {
  label: string;
  used: number;
  total: number;
}

interface Band {
  icon: IconName;
  textClass: string;
  fillClass: string;
  status: string;
}

function bandFor(pct: number): Band {
  if (pct >= 100) {
    return {
      icon: 'octagon-alert',
      textClass: 'text-cl-crit',
      fillClass: 'bg-cl-crit',
      status: 'Over',
    };
  }
  if (pct >= 80) {
    return {
      icon: 'triangle-alert',
      textClass: 'text-cl-warn',
      fillClass: 'bg-cl-warn',
      status: `${Math.round(pct)}% used`,
    };
  }
  return { icon: 'check', textClass: 'text-cl-pos', fillClass: 'bg-cl-pos', status: 'On track' };
}

/** Threshold bands at normal / 80% / over — percentage and overage are always spelled out in text, color reinforces rather than carries the message. */
export function BudgetGauge({ label, used, total }: BudgetGaugeProps) {
  const safeTotal = total || 1;
  const pctRaw = (used / safeTotal) * 100;
  const pct = Math.round(pctRaw);
  const band = bandFor(pctRaw);

  const footText =
    pctRaw >= 100
      ? `${pct}% — ${formatMoney(used - total)} over`
      : pctRaw >= 80
        ? `${pct}% of budget used`
        : `${pct}% used`;

  return (
    <div className="bg-cl-surface border-cl-border rounded-xl border p-5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-cl-text text-[13px] font-semibold">{label}</span>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${band.textClass}`}
        >
          <Icon name={band.icon} size={11} />
          {band.status}
        </span>
      </div>
      <div className="bg-cl-surface-2 mb-2.5 h-[9px] overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${band.fillClass}`}
          style={{ width: `${Math.min(100, pctRaw)}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs tabular-nums">
        <span className={pctRaw >= 80 ? `font-semibold ${band.textClass}` : 'text-cl-text-2'}>
          {footText}
        </span>
        <span className="text-cl-text-3">
          {formatMoney(used)} / {formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
