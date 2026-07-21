/** Root key for the org's policy queries (approval ladder + spend controls). */
export const POLICIES_QUERY_KEY = ['policies'] as const;

/** One key factory so each query and its invalidations can't disagree. */
export const policiesKeys = {
  approvalPolicy: [...POLICIES_QUERY_KEY, 'approval-policy'] as const,
  spendControls: [...POLICIES_QUERY_KEY, 'spend-controls'] as const,
};
