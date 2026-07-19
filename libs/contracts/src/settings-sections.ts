/**
 * Every deep-linkable /settings section slug (EPIC-CW-022 / US-CW-033). This is the shared vocabulary
 * the web app's SettingsNav, the route tree, and the mock-backend authorization handler all speak, so
 * the client's "what to show" and the server's "what to allow" can never drift. The permission each
 * slug requires — and therefore which are Profile (universal) vs Organization (gated) — is the
 * authorization policy, and lives in @clearline/domain-auth (SETTINGS_SECTION_PERMISSION).
 */
export type SettingsSectionSlug =
  // Profile group — every authenticated user manages their own; no permission required.
  | 'personal'
  | 'security'
  | 'notifications'
  // Organization group — Controller/Admin/Owner org-config, or Admin/Owner-only.
  | 'company'
  // Team & Members — the US-CW-031 team surface, relocated into Settings; gated by team:view.
  | 'team'
  | 'approval-policies'
  | 'spend-controls'
  | 'card-program'
  | 'connected-accounts'
  | 'integrations'
  | 'org-notifications'
  | 'security-compliance'
  | 'developer'
  | 'billing';

/** 200 body of GET /api/settings/sections/:slug — the caller may reach this section (US-CW-033 AC-04). */
export interface SettingsSectionAccessResponse {
  slug: SettingsSectionSlug;
  authorized: true;
}

/** Body of a 403 from a settings endpoint — the client maps `error` to the AccessDenied surface. */
export interface SettingsErrorResponse {
  error: 'forbidden_role';
}
