import type { DateRange } from '@clearline/contracts';
import { Text, formatMoneyValue } from '@clearline/ui';
import { useSpendByCategory } from '@clearline/data-access-analytics';
import { SectionCard, SkeletonRows } from './section-chrome';
import { SectionErrorCard } from './SectionErrorCard';

const TITLE = 'Spend by category';

/**
 * Spend broken down by category as labelled bars (US-CW-015 AC-01). Independently fetched, so its own
 * loading skeleton and scoped error card never affect the sibling sections (AC-05). Bar widths come
 * pre-computed from the server (`fractionOfMax`), keeping this component purely presentational.
 */
export function SpendByCategorySection({ range }: { range: DateRange }) {
  const query = useSpendByCategory(range);

  if (query.isError) {
    return <SectionErrorCard title={TITLE} onRetry={() => void query.refetch()} />;
  }

  return (
    <SectionCard title={TITLE}>
      {query.isPending ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="flex flex-col gap-2.75">
          {query.data.categories.map((c) => (
            <div key={c.category} className="flex items-center gap-2.75">
              <Text as="span" size="label" tone="muted" className="w-[118px] shrink-0">
                {c.category}
              </Text>
              <div className="bg-cl-surface-2 h-2 flex-1 overflow-hidden rounded">
                <div
                  className="bg-cl-accent h-full rounded"
                  style={{ width: `${Math.round(c.fractionOfMax * 100)}%` }}
                />
              </div>
              <Text
                as="span"
                size="mono"
                weight="semibold"
                tone="default"
                className="w-[86px] shrink-0 text-right tabular-nums"
              >
                {formatMoneyValue(c.amount)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
