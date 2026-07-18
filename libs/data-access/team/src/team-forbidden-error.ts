/**
 * Thrown when a team endpoint returns 403 — the redundant server-side Owner/Admin check behind the
 * `team:view` route guard, even if the client guard was bypassed or the caller's authority was removed
 * mid-session (US-CW-031 AC-07). The page degrades to an access-denied state, never a generic error.
 */
export class TeamForbiddenError extends Error {
  constructor() {
    super('team_forbidden');
    this.name = 'TeamForbiddenError';
  }
}
