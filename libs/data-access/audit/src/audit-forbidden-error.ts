/**
 * Thrown when GET /api/audit-log returns 403 — the redundant server-side `audit:view` check behind
 * the route guard, enforced even if the client guard was bypassed or the viewer's role was downgraded
 * mid-session (US-CW-021 AC-06). The page degrades to an access-denied state rather than a generic
 * error, and never a limited/read-only view.
 */
export class AuditForbiddenError extends Error {
  constructor() {
    super('audit_forbidden');
    this.name = 'AuditForbiddenError';
  }
}
