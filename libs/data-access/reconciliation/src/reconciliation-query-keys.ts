/**
 * Root key for every reconciliation query — a confirm/reject/dismiss/split or a re-run invalidates this
 * whole subtree at once, so the summary counts, exceptions queue and matched list all refetch together
 * and never drift apart (US-CW-016).
 */
export const RECONCILIATION_QUERY_KEY = ['reconciliation'] as const;

/** One key factory per panel, so a query and its invalidations can't disagree. */
export const reconciliationKeys = {
  summary: () => [...RECONCILIATION_QUERY_KEY, 'summary'] as const,
  exceptions: () => [...RECONCILIATION_QUERY_KEY, 'exceptions'] as const,
  matched: () => [...RECONCILIATION_QUERY_KEY, 'matched'] as const,
  balance: () => [...RECONCILIATION_QUERY_KEY, 'balance'] as const,
};
