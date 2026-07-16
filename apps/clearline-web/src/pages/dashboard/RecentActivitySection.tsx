import type { DateRange, SpendTransaction } from '@clearline/contracts';
import { Icon, Text, formatMoneyValue } from '@clearline/ui';
import { useRecentActivity } from '@clearline/data-access-analytics';
import { SectionCard, SkeletonRows } from './section-chrome';
import { SectionErrorCard } from './SectionErrorCard';

const TITLE = 'Recent activity';

/** "2026-06-26" → "Jun 26" without a date lib, matching the rest of the app's date columns. */
function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * A single activity row. An anomaly-flagged transaction (US-CW-015 AC-02) carries a warning glyph
 * PLUS the text "Unusual amount" and the AI confidence — the flag is never conveyed by colour alone,
 * so it survives for colourblind viewers and screen readers. The subtitle also states the normal
 * amount it deviated from.
 */
function ActivityRow({ txn, isLast }: { txn: SpendTransaction; isLast: boolean }) {
  const flagged = Boolean(txn.anomaly);
  return (
    <div
      className={[
        'flex items-center gap-2.75 rounded-lg px-2.5 py-2',
        flagged
          ? 'border-cl-border bg-cl-warn-weak mb-1 border'
          : isLast
            ? ''
            : 'border-cl-border border-b',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Text as="span" size="label" weight="semibold" tone="default">
            {txn.vendor}
          </Text>
          {txn.anomaly ? (
            <span className="text-cl-warn inline-flex items-center gap-1 text-[10.5px] font-semibold">
              <Icon name="triangle-alert" size={11} className="shrink-0" />
              Unusual amount
            </span>
          ) : null}
        </div>
        <Text as="p" size="label" tone="muted" className="mt-0.5 mb-0 text-[10.5px]">
          {txn.category} &middot; {formatDate(txn.date)}
          {txn.anomaly ? (
            <>
              {txn.anomaly.normalAmount
                ? ` · normally ~${formatMoneyValue(txn.anomaly.normalAmount)}`
                : ''}
              {' · '}
              <span className="text-cl-warn font-semibold">
                AI {txn.anomaly.confidencePercent}% confidence
              </span>
            </>
          ) : null}
        </Text>
      </div>
      <Text
        as="span"
        size="mono"
        weight="semibold"
        tone="default"
        className="shrink-0 tabular-nums"
      >
        {formatMoneyValue(txn.amount)}
      </Text>
    </div>
  );
}

/** The recent-activity feed (US-CW-015 AC-01/AC-02) — independently fetched and error-isolated (AC-05). */
export function RecentActivitySection({ range }: { range: DateRange }) {
  const query = useRecentActivity(range);

  if (query.isError) {
    return <SectionErrorCard title={TITLE} onRetry={() => void query.refetch()} />;
  }

  return (
    <SectionCard title={TITLE}>
      {query.isPending ? (
        <SkeletonRows rows={4} />
      ) : (
        <div>
          {query.data.transactions.map((txn, i, all) => (
            <ActivityRow key={txn.id} txn={txn} isLast={i === all.length - 1} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
