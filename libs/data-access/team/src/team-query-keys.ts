/**
 * Root key for every team query — inviting, changing a role, or removing a member invalidates this
 * whole subtree so the roster refetches and reflects the change immediately (US-CW-031).
 */
export const TEAM_QUERY_KEY = ['team'] as const;

/** One key factory per view so a query and its invalidations can't disagree. */
export const teamKeys = {
  roster: () => [...TEAM_QUERY_KEY, 'roster'] as const,
  invite: (token: string) => [...TEAM_QUERY_KEY, 'invite', token] as const,
};
