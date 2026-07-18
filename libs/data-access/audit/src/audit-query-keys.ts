/**
 * Root key for the audit-log query (US-CW-021). The log is read-only and append-only, so there's a
 * single key rather than a per-panel factory — nothing mutates it client-side to invalidate against.
 */
export const AUDIT_QUERY_KEY = ['audit'] as const;

export const auditKeys = {
  log: () => [...AUDIT_QUERY_KEY, 'log'] as const,
};
