import { useQuery } from '@tanstack/react-query';
import type { DateRange, SpendByCategoryResponse } from '@clearline/contracts';
import { analyticsKeys } from './analytics-query-keys';
import { fetchAnalyticsSection } from './fetch-section';

/** Spend broken down by category for a range — an independently-fetched section (US-CW-015 AC-01/AC-05). */
export function useSpendByCategory(range: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.spendByCategory(range),
    queryFn: () => fetchAnalyticsSection<SpendByCategoryResponse>('spend-by-category', range),
    retry: false,
  });
}
