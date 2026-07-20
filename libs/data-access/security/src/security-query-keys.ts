/** Root key for every account-security query, so all of it can be invalidated together. */
export const SECURITY_QUERY_KEY = ['security'] as const;

/** One key factory per security query so a query and its invalidations can't disagree. */
export const securityKeys = {
  root: SECURITY_QUERY_KEY,
  twoFactor: [...SECURITY_QUERY_KEY, 'two-factor'] as const,
  sessions: [...SECURITY_QUERY_KEY, 'sessions'] as const,
  trustedDevices: [...SECURITY_QUERY_KEY, 'trusted-devices'] as const,
};
