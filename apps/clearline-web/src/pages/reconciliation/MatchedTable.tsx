import type { MatchedEntry } from '@clearline/contracts';
import { formatMoneyValue, EmptyState, StatusBadge, Text } from '@clearline/ui';

const METHOD_LABEL: Record<MatchedEntry['method'], string> = {
  exact: 'Exact match',
  fuzzy: 'Confirmed match',
  manual: 'Manual match',
  split: 'Split match',
};

export interface MatchedTableProps {
  matched: MatchedEntry[];
  /** The run's total auto-matched count; when it exceeds the enumerated rows, a caption explains the gap. */
  totalMatched?: number;
}

/**
 * The reconciled matches (US-CW-016 AC-01) — each bank line tied to its ledger entry (or entries, for a
 * split), tagged "Matched". The bulk of the nightly job's auto-matches aren't enumerated here; this is
 * the recent, individually-actionable set, so a Finance Manager can see exactly what reconciled and how.
 * A caption reconciles the shown rows with the full auto-matched total when they differ.
 */
export function MatchedTable({ matched, totalMatched }: MatchedTableProps) {
  if (matched.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No matches yet"
        body="Run the reconciliation job to match bank transactions against the ledger."
      />
    );
  }

  const showCaption = typeof totalMatched === 'number' && totalMatched > matched.length;

  return (
    <div className="overflow-x-auto">
      {showCaption ? (
        <Text as="p" size="label" tone="faint" className="mb-2.5">
          Showing the {matched.length} most recent of {totalMatched} auto-matched transactions.
        </Text>
      ) : null}
      <div className="min-w-[560px]">
        {matched.map((entry) => (
          <div
            key={entry.id}
            className="border-cl-border grid grid-cols-[1.4fr_1.4fr_1fr] items-center gap-3 border-b px-3 py-3"
          >
            <div>
              <Text as="div" size="label" weight="medium" tone="default" className="mb-0.5">
                {entry.bankTransaction.payee}
              </Text>
              <Text as="div" size="label" tone="muted" className="mb-0 font-mono tabular-nums">
                {formatMoneyValue(entry.bankTransaction.amount)} · {entry.bankTransaction.date}
              </Text>
            </div>
            <Text as="div" size="label" tone="muted" className="mb-0">
              {entry.ledgerEntries.map((l) => l.description).join(' + ')}
            </Text>
            <div className="flex items-center gap-2">
              <StatusBadge status="matched" />
              <Text as="span" size="label" tone="faint">
                {METHOD_LABEL[entry.method]}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
