import type { ReactNode } from 'react';
import type { SpendSummary } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';
import { MoneyDisplay, Text, formatMoneyValue } from '@clearline/ui';
import { SectionErrorCard } from './SectionErrorCard';

const TITLE = 'Spend overview';

function Tile({
  label,
  children,
  caption,
}: {
  label: string;
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
      <Text as="div" size="label" tone="faint" className="mb-1.5">
        {label}
      </Text>
      {children}
      {caption ? (
        <Text as="div" size="label" tone="muted" className="mt-1.5">
          {caption}
        </Text>
      ) : null}
    </div>
  );
}

/** A number that isn't money (counts) — skeleton while loading so it never flashes a false zero (AC-01). */
function CountValue({ value, loading }: { value: number; loading: boolean }) {
  if (loading) {
    return <div className="cl-skeleton h-[30px] w-[64px] rounded-md" aria-hidden="true" />;
  }
  return <div className="text-cl-text font-mono text-2xl font-semibold tabular-nums">{value}</div>;
}

export interface SummaryTilesProps {
  summary?: SpendSummary;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Human label for the total-spend tile, e.g. "June 2026". */
  periodLabel: string;
}

/**
 * The four KPI tiles (US-CW-015 AC-01). Money renders through MoneyDisplay — a shimmer skeleton while
 * loading, never a "$0.00" flash that would imply zero spend. Budget remaining is a ledger projection,
 * so it carries the "DERIVED · READ-ONLY" chip. A summary fetch failure is isolated to this row (AC-05).
 */
export function SummaryTiles({
  summary,
  isPending,
  isError,
  onRetry,
  periodLabel,
}: SummaryTilesProps) {
  if (isError) {
    return <SectionErrorCard title={TITLE} onRetry={onRetry} />;
  }

  const loading = isPending || !summary;

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
      <Tile label={`Total spend · ${periodLabel}`}>
        <MoneyDisplay
          amount={summary ? toMajorUnits(summary.totalSpend) : 0}
          state={loading ? 'loading' : 'loaded'}
        />
      </Tile>
      <Tile
        label="Pending approvals"
        caption={
          summary ? `${formatMoneyValue(summary.pendingApprovalsAmount)} awaiting` : undefined
        }
      >
        <CountValue value={summary?.pendingApprovalsCount ?? 0} loading={loading} />
      </Tile>
      <Tile
        label="Budget remaining"
        caption={summary ? `of ${formatMoneyValue(summary.budgetTotal)} across depts` : undefined}
      >
        <MoneyDisplay
          amount={summary ? toMajorUnits(summary.budgetRemaining) : 0}
          state={loading ? 'loading' : 'loaded'}
          derived
        />
      </Tile>
      <Tile label="Active cards" caption={summary ? `${summary.frozenCards} frozen` : undefined}>
        <CountValue value={summary?.activeCards ?? 0} loading={loading} />
      </Tile>
    </div>
  );
}
