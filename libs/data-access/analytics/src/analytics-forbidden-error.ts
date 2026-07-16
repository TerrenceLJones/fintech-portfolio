/**
 * Thrown when an analytics endpoint returns 403 — the redundant server-side `analytics:view` check
 * behind US-CW-015's route guard, even if the client-side guard was somehow bypassed or the viewer's
 * role was downgraded mid-session. The page degrades to an access-denied state rather than a generic
 * section error.
 */
export class AnalyticsForbiddenError extends Error {
  constructor() {
    super('analytics_forbidden');
    this.name = 'AnalyticsForbiddenError';
  }
}
