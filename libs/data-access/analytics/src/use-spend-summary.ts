import { useQuery } from '@tanstack/react-query';
import type { DateRange, SpendSummaryResponse } from '@clearline/contracts';
import { analyticsKeys } from './analytics-query-keys';
import { fetchAnalyticsSection } from './fetch-section';

/**
 * The dashboard's KPI summary + freshness stamp for a range (US-CW-015 AC-01/AC-06). Independently
 * fetched from the other sections so its failure is isolated (AC-05); `transactionCount === 0` is the
 * signal the page uses to render the empty state rather than an error (AC-03).
 */
export function useSpendSummary(range: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.summary(range),
    queryFn: () => fetchAnalyticsSection<SpendSummaryResponse>('summary', range),
    retry: false,
  });
}
