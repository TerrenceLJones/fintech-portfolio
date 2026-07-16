import type { DateRange } from '@clearline/contracts';

/** Root key for every analytics query — the manual Refresh invalidates this whole subtree at once (AC-06). */
export const ANALYTICS_QUERY_KEY = ['analytics'] as const;

/**
 * Section keys are scoped by range so switching the date filter caches each range independently and
 * never shows one range's numbers under another's (US-CW-015). One key factory per section keeps the
 * query and its invalidations from drifting apart.
 */
export const analyticsKeys = {
  summary: (range: DateRange) => [...ANALYTICS_QUERY_KEY, 'summary', range.from, range.to] as const,
  spendByCategory: (range: DateRange) =>
    [...ANALYTICS_QUERY_KEY, 'spend-by-category', range.from, range.to] as const,
  byDepartment: (range: DateRange) =>
    [...ANALYTICS_QUERY_KEY, 'by-department', range.from, range.to] as const,
  topVendors: (range: DateRange) =>
    [...ANALYTICS_QUERY_KEY, 'top-vendors', range.from, range.to] as const,
  recentActivity: (range: DateRange) =>
    [...ANALYTICS_QUERY_KEY, 'recent-activity', range.from, range.to] as const,
};

/** The query string for a section fetch, e.g. `?from=2026-06-01&to=2026-06-30`. */
export function rangeQuery(range: DateRange): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return `?${params.toString()}`;
}
