import { useQuery } from '@tanstack/react-query';
import type { DateRange, RecentActivityResponse } from '@clearline/contracts';
import { analyticsKeys } from './analytics-query-keys';
import { fetchAnalyticsSection } from './fetch-section';

/**
 * The recent-activity feed for a range — an independently-fetched section carrying anomaly flags with
 * confidence for the "Unusual amount" treatment (US-CW-015 AC-02/AC-05).
 */
export function useRecentActivity(range: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.recentActivity(range),
    queryFn: () => fetchAnalyticsSection<RecentActivityResponse>('recent-activity', range),
    retry: false,
  });
}
