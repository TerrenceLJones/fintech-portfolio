import { useQuery } from '@tanstack/react-query';
import type { ByDepartmentResponse, DateRange } from '@clearline/contracts';
import { analyticsKeys } from './analytics-query-keys';
import { fetchAnalyticsSection } from './fetch-section';

/** Spend broken down by department for a range — an independently-fetched section (US-CW-015 AC-01/AC-05). */
export function useByDepartment(range: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.byDepartment(range),
    queryFn: () => fetchAnalyticsSection<ByDepartmentResponse>('by-department', range),
    retry: false,
  });
}
