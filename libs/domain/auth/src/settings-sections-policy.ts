import type { Permission, SettingsSectionSlug } from '@clearline/contracts';
import { hasPermission } from './authorization-policy';

/**
 * The permission each /settings section requires (EPIC-CW-022 / US-CW-033). `null` marks a Profile
 * section every authenticated user may reach (Personal Info, Security, Notifications). This one table
 * is the single source of truth the SettingsNav (client "hide") and the settings API handler (server
 * "decide") both read, so the two can never disagree about which sections a role may see.
 */
export const SETTINGS_SECTION_PERMISSION: Record<SettingsSectionSlug, Permission | null> = {
  // Profile group — universal.
  personal: null,
  security: null,
  notifications: null,
  // Organization group — Controller or Admin/Owner org-config.
  company: 'org-profile:manage',
  // Team & Members (US-CW-031, relocated into Settings) — gated by team:view (Owner or Admin).
  team: 'team:view',
  'approval-policies': 'policies:manage',
  'spend-controls': 'policies:manage',
  'card-program': 'card-program:manage',
  'connected-accounts': 'bank-accounts:manage',
  integrations: 'integrations:manage',
  'org-notifications': 'integrations:manage',
  // Organization group — Admin/Owner only.
  'security-compliance': 'org-security:manage',
  developer: 'developer:manage',
  billing: 'billing:manage',
};

/** Section slugs in canonical SettingsNav render order (Profile group first, then Organization). */
const SETTINGS_SECTION_ORDER = Object.keys(SETTINGS_SECTION_PERMISSION) as SettingsSectionSlug[];

/**
 * The permission an arbitrary slug requires: `null` for a Profile section, the token for an
 * Organization section, or `undefined` when the slug is not a known settings section (so a handler
 * can answer 404 rather than mistakenly authorizing an unknown route).
 */
export function permissionForSettingsSection(slug: string): Permission | null | undefined {
  if (Object.prototype.hasOwnProperty.call(SETTINGS_SECTION_PERMISSION, slug)) {
    return SETTINGS_SECTION_PERMISSION[slug as SettingsSectionSlug];
  }
  return undefined;
}

/**
 * The settings sections a permission set authorizes, in canonical order. Profile sections are always
 * included (they need no permission); an Organization section is included only when its token is held.
 * Used server-side to answer "which sections may this user reach" and mirrored client-side by the
 * SettingsNav filter.
 */
export function authorizedSettingsSections(
  permissions: readonly Permission[],
): SettingsSectionSlug[] {
  return SETTINGS_SECTION_ORDER.filter((slug) => {
    const required = SETTINGS_SECTION_PERMISSION[slug];
    return required === null || hasPermission(permissions, required);
  });
}
