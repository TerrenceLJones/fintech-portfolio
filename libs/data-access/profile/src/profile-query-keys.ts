/** Root key for every personal-profile query, so all of it can be invalidated together. */
export const PROFILE_QUERY_KEY = ['profile'] as const;

/**
 * The session query key (owned by @clearline/data-access-auth's useSession). Profile and avatar
 * mutations invalidate it so the sidebar identity footer — which reads name + avatar from the
 * session — updates live (US-CW-034 AC-05), keeping a single avatar source of truth.
 */
export const SESSION_QUERY_KEY = ['session'] as const;

/** One key factory per profile query so a query and its invalidations can't disagree. */
export const profileKeys = {
  profile: PROFILE_QUERY_KEY,
  notifications: [...PROFILE_QUERY_KEY, 'notifications'] as const,
  emailChangeToken: (token: string) => [...PROFILE_QUERY_KEY, 'email-change', token] as const,
};
