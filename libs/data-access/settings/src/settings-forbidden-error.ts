/**
 * Thrown when a settings endpoint returns 403 — the redundant server-side org-settings check behind
 * the RequirePermission route guard (US-CW-033 AC-04), even if the client guard were bypassed or the
 * caller's authority was removed mid-session. A settings section degrades to an access-denied state,
 * never a generic error.
 */
export class SettingsForbiddenError extends Error {
  constructor() {
    super('settings_forbidden');
    this.name = 'SettingsForbiddenError';
  }
}
