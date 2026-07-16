import type { DateRange } from '@clearline/contracts';
import { Text, formatMoneyValue } from '@clearline/ui';
import { useTopVendors } from '@clearline/data-access-analytics';
import { SectionCard, SkeletonRows } from './section-chrome';
import { SectionErrorCard } from './SectionErrorCard';

const TITLE = 'Top vendors';

/**
 * Top vendors by spend (US-CW-015 AC-01). This is the section AC-05 uses to demonstrate isolated
 * failure: when its fetch 500s, only this card shows "This section couldn't load. Retry." while every
 * sibling renders normally.
 */
export function TopVendorsSection({ range }: { range: DateRange }) {
  const query = useTopVendors(range);

  if (query.isError) {
    return <SectionErrorCard title={TITLE} onRetry={() => void query.refetch()} />;
  }

  return (
    <SectionCard title={TITLE}>
      {query.isPending ? (
        <SkeletonRows rows={5} />
      ) : (
        <div>
          {query.data.vendors.map((v) => (
            <div key={v.vendor} className="flex items-center justify-between py-1.5">
              <Text as="span" size="label" tone="muted">
                {v.vendor}
              </Text>
              <Text as="span" size="mono" weight="semibold" tone="default" className="tabular-nums">
                {formatMoneyValue(v.amount)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
