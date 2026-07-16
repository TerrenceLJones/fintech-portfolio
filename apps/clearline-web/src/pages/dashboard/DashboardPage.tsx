import type { DateRange } from '@clearline/contracts';
import { AccessDenied, Button, EmptyState, Icon, Text } from '@clearline/ui';
import {
  AnalyticsForbiddenError,
  formatRelativeAge,
  isStale,
  useSpendSummary,
  useRefreshAnalytics,
} from '@clearline/data-access-analytics';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { dashboardBeacon } from './DashboardPage.beacon';
import { DEFAULT_DASHBOARD_RANGE, useDashboardFilter } from './useDashboardFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { SummaryTiles } from './SummaryTiles';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { SpendByCategorySection } from './SpendByCategorySection';
import { ByDepartmentSection } from './ByDepartmentSection';
import { TopVendorsSection } from './TopVendorsSection';
import { RecentActivitySection } from './RecentActivitySection';

/** "2026-06-01" → Date at local midnight, or null for a malformed value. */
function parseDate(iso: string): Date | null {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A human label for the range: a whole calendar month collapses to "June 2026"; anything else reads
 * as "Jun 1 – Jul 7, 2026". Purely cosmetic — the query always uses the exact from/to.
 */
function formatPeriodLabel(range: DateRange): string {
  const from = parseDate(range.from);
  const to = parseDate(range.to);
  if (!from || !to) return `${range.from} – ${range.to}`;

  const lastOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const isWholeMonth =
    from.getDate() === 1 &&
    to.getDate() === lastOfMonth &&
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear();
  if (isWholeMonth) {
    return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${short(from)} – ${short(to)}, ${to.getFullYear()}`;
}

const DEFAULT_PERIOD_LABEL = formatPeriodLabel(DEFAULT_DASHBOARD_RANGE);

/**
 * The real-time spend analytics dashboard (US-CW-015). Each section — summary, spend-by-category,
 * by-department, top-vendors, recent-activity — is fetched independently and wrapped in its own error
 * boundary, so one section's backend failure is isolated with a scoped retry while the rest of the
 * page renders (AC-05). Money renders skeleton-first, never a false "$0.00" (AC-01); the date range is
 * validated before it's applied (AC-04); an empty range shows a distinct empty state, not an error
 * (AC-03); anomalies carry an icon + label + confidence (AC-02); and a freshness stamp with a manual
 * Refresh surfaces stale data (AC-06).
 */
export function DashboardPage() {
  usePageTitle('Spend overview');
  useDemoBeacon(dashboardBeacon);

  const filter = useDashboardFilter();
  const summary = useSpendSummary(filter.committedRange);
  const refresh = useRefreshAnalytics();

  // A mid-session downgrade (or a bypassed route guard) degrades to access-denied, not a broken page.
  if (summary.error instanceof AnalyticsForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/analytics/summary" />;
  }

  const periodLabel = formatPeriodLabel(filter.committedRange);
  const data = summary.data?.summary;
  // Measure freshness against when the client actually fetched (a pure value from the query), not a
  // Date.now() read during render. After a manual Refresh both timestamps advance together → "just now".
  const now = summary.dataUpdatedAt;
  const stale = data ? isStale(data.lastRefreshedAt, now) : false;
  const freshnessLabel = data ? formatRelativeAge(data.lastRefreshedAt, now) : null;
  const isEmpty = data?.transactionCount === 0;

  const refreshButton = (
    <Button
      variant={stale ? 'primary' : 'secondary'}
      size="sm"
      icon="refresh"
      loading={refresh.isPending}
      onClick={() => refresh.mutate()}
    >
      Refresh
    </Button>
  );

  return (
    <div className="font-sans">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Text as="h2" size="heading" tone="default" className="mb-0.5">
            Spend overview
          </Text>
          <Text as="p" size="label" tone="muted" className="mb-0">
            All departments &middot; {periodLabel}
          </Text>
        </div>
        {!stale && freshnessLabel ? (
          <div className="flex items-center gap-2.5">
            <Text as="span" size="label" tone="faint">
              Updated {freshnessLabel}
            </Text>
            {refreshButton}
          </div>
        ) : (
          <div>{refreshButton}</div>
        )}
      </div>

      {/* Stale-data indicator (AC-06): surfaces the data's age with a manual Refresh; values stay shown. */}
      {stale && freshnessLabel ? (
        <div
          className="bg-cl-warn-weak mb-4 flex items-center gap-2.5 rounded-lg px-4 py-2.75"
          role="status"
        >
          <Icon name="clock" size={15} className="text-cl-warn shrink-0" />
          <Text as="span" size="label" tone="warning" weight="medium">
            Last updated {freshnessLabel}
          </Text>
        </div>
      ) : null}

      <div className="mb-4.5">
        <DateRangeFilter
          draft={filter.draft}
          validation={filter.validation}
          isDirty={filter.isDirty}
          onChange={filter.setDraft}
          onApply={filter.apply}
        />
      </div>

      {isEmpty ? (
        // A range with no transactions is an empty state, never an error (AC-03).
        <EmptyState
          icon="search"
          title="No transactions in this date range"
          body="Try widening the range or selecting a different period to see spend."
          action={`Reset to ${DEFAULT_PERIOD_LABEL}`}
          onAction={filter.reset}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          <SectionErrorBoundary title="Spend overview" onReset={() => void summary.refetch()}>
            <SummaryTiles
              summary={data}
              isPending={summary.isPending}
              isError={summary.isError}
              onRetry={() => void summary.refetch()}
              periodLabel={periodLabel}
            />
          </SectionErrorBoundary>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[1.25fr_1fr]">
            <SectionErrorBoundary title="Spend by category">
              <SpendByCategorySection range={filter.committedRange} />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="By department">
              <ByDepartmentSection range={filter.committedRange} />
            </SectionErrorBoundary>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[1fr_1.25fr]">
            <SectionErrorBoundary title="Top vendors">
              <TopVendorsSection range={filter.committedRange} />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Recent activity">
              <RecentActivitySection range={filter.committedRange} />
            </SectionErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
}
