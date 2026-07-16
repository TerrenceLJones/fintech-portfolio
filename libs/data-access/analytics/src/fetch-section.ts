import type { DateRange } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { AnalyticsForbiddenError } from './analytics-forbidden-error';
import { rangeQuery } from './analytics-query-keys';

/**
 * Fetch one dashboard section for a range. A 403 becomes AnalyticsForbiddenError (access-denied);
 * any other non-2xx throws so React Query surfaces the section's own error state — which the page
 * renders as the scoped "This section couldn't load. Retry." card, isolated from its siblings (AC-05).
 */
export async function fetchAnalyticsSection<T>(section: string, range: DateRange): Promise<T> {
  const response = await authenticatedFetch(`/api/analytics/${section}${rangeQuery(range)}`);
  if (response.status === 403) {
    throw new AnalyticsForbiddenError();
  }
  if (!response.ok) {
    throw new Error(`analytics_${section}_failed`);
  }
  return response.json() as Promise<T>;
}
