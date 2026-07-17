/**
 * Thrown when a reconciliation endpoint returns 403 — the redundant server-side `reconciliation:view`
 * check behind the route guard, even if the client guard was bypassed or the viewer's role was
 * downgraded mid-session. The page degrades to an access-denied state rather than a generic error.
 */
export class ReconciliationForbiddenError extends Error {
  constructor() {
    super('reconciliation_forbidden');
    this.name = 'ReconciliationForbiddenError';
  }
}
