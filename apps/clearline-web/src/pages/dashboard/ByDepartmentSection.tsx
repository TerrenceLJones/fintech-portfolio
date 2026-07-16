import type { DateRange } from '@clearline/contracts';
import { Text, formatMoneyValue } from '@clearline/ui';
import { useByDepartment } from '@clearline/data-access-analytics';
import { SectionCard, SkeletonRows } from './section-chrome';
import { SectionErrorCard } from './SectionErrorCard';

const TITLE = 'By department';

/** Spend by department as a ranked list (US-CW-015 AC-01) — independently fetched and error-isolated (AC-05). */
export function ByDepartmentSection({ range }: { range: DateRange }) {
  const query = useByDepartment(range);

  if (query.isError) {
    return <SectionErrorCard title={TITLE} onRetry={() => void query.refetch()} />;
  }

  return (
    <SectionCard title={TITLE}>
      {query.isPending ? (
        <SkeletonRows rows={5} />
      ) : (
        <div>
          {query.data.departments.map((d, i, all) => (
            <div
              key={d.department}
              className={[
                'flex items-center justify-between py-1.75',
                i < all.length - 1 ? 'border-cl-border border-b' : '',
              ].join(' ')}
            >
              <Text as="span" size="label" tone="default">
                {d.department}
              </Text>
              <Text as="span" size="mono" weight="semibold" tone="default" className="tabular-nums">
                {formatMoneyValue(d.amount)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
