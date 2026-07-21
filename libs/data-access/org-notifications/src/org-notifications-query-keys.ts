/** Root key for the org's notification settings; every mutation invalidates it (US-CW-039). */
export const ORG_NOTIFICATIONS_QUERY_KEY = ['org-notifications'] as const;

/** Key for the addable-member candidate list (AC-07). */
export const RECIPIENT_CANDIDATES_QUERY_KEY = ['org-notifications', 'candidates'] as const;
