/** Root key for every settings query, so a permission change can invalidate the whole subtree. */
export const SETTINGS_QUERY_KEY = ['settings'] as const;

/** One key factory per settings query so a query and its invalidations can't disagree. */
export const settingsKeys = {
  sectionAccess: (slug: string) => [...SETTINGS_QUERY_KEY, 'section-access', slug] as const,
};
