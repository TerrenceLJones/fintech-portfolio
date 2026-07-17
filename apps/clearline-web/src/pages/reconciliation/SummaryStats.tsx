import type { ReactNode } from 'react';
import type { ReconciliationSummary } from '@clearline/contracts';
import { Icon, Text } from '@clearline/ui';
import type { IconName } from '@clearline/icons';
import { PanelError } from './recon-chrome';

function StatCard({
  label,
  value,
  icon,
  iconClassName,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon?: IconName;
  iconClassName?: string;
  loading: boolean;
}) {
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-[15px]">
      <Text as="div" size="label" tone="faint" className="mb-1.5">
        {label}
      </Text>
      {loading ? (
        <div className="cl-skeleton h-[26px] w-[72px] rounded-md" aria-hidden="true" />
      ) : (
        <div className="flex items-center gap-1.5">
          {icon ? <Icon name={icon} size={17} className={iconClassName} /> : null}
          <span className="text-cl-text font-mono text-xl font-semibold tabular-nums">{value}</span>
        </div>
      )}
    </div>
  );
}

export interface SummaryStatsProps {
  summary?: ReconciliationSummary;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * The reconciliation run's three headline stats (US-CW-016 AC-01): how many lines auto-matched, how
 * many landed in the exceptions queue (warning-toned with an icon, never colour alone), and the overall
 * match rate. Counts render skeleton-first so a slow load never flashes a false zero.
 */
export function SummaryStats({ summary, isPending, isError, onRetry }: SummaryStatsProps) {
  if (isError) return <PanelError title="Reconciliation summary" onRetry={onRetry} />;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <StatCard
        label="Auto-matched"
        value={summary?.autoMatchedCount ?? 0}
        icon="check"
        iconClassName="text-cl-pos"
        loading={isPending}
      />
      <StatCard
        label="Exceptions"
        value={summary?.exceptionsCount ?? 0}
        icon="triangle-alert"
        iconClassName="text-cl-warn"
        loading={isPending}
      />
      <StatCard
        label="Match rate"
        value={summary ? `${summary.matchRatePercent}%` : '—'}
        loading={isPending}
      />
    </div>
  );
}
