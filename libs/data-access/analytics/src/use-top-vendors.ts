import { useQuery } from '@tanstack/react-query';
import type { DateRange, TopVendorsResponse } from '@clearline/contracts';
import { analyticsKeys } from './analytics-query-keys';
import { fetchAnalyticsSection } from './fetch-section';

/** Top vendors by spend for a range — the section AC-05 uses to demonstrate isolated failure + retry. */
export function useTopVendors(range: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.topVendors(range),
    queryFn: () => fetchAnalyticsSection<TopVendorsResponse>('top-vendors', range),
    retry: false,
  });
}
