import type { Permission, SettingsSectionSlug } from '@clearline/contracts';
import { SETTINGS_SECTION_PERMISSION } from '@clearline/domain-auth';
import type { SettingsNavGroup } from '@clearline/ui';

/**
 * The app-layer /settings catalogue (US-CW-033). Like nav-items.ts for the primary rail, this owns the
 * presentational concerns the router-agnostic SettingsNav deliberately keeps out — the human label,
 * the two-tier group, and the route — while the authorization (which permission each slug needs, hence
 * which are universal Profile vs gated Organization) stays the single source of truth in
 * @clearline/domain-auth (SETTINGS_SECTION_PERMISSION). Order here is the SettingsNav render order.
 * Team & Members is intentionally absent: it is a top-level primary-sidebar destination (US-CW-031),
 * never surfaced inside Settings.
 */
type SettingsGroupId = 'profile' | 'organization';

interface SettingsSectionDef {
  slug: SettingsSectionSlug;
  label: string;
  group: SettingsGroupId;
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { slug: 'personal', label: 'Personal Info', group: 'profile' },
  { slug: 'security', label: 'Security', group: 'profile' },
  { slug: 'notifications', label: 'Notifications', group: 'profile' },
  { slug: 'company', label: 'Company Profile', group: 'organization' },
  { slug: 'team', label: 'Team & Members', group: 'organization' },
  { slug: 'approval-policies', label: 'Approval Policies', group: 'organization' },
  { slug: 'spend-controls', label: 'Spend Controls', group: 'organization' },
  { slug: 'card-program', label: 'Card Program', group: 'organization' },
  { slug: 'connected-accounts', label: 'Connected Accounts', group: 'organization' },
  { slug: 'integrations', label: 'Integrations', group: 'organization' },
  { slug: 'org-notifications', label: 'Organization Notifications', group: 'organization' },
  { slug: 'security-compliance', label: 'Security & Compliance', group: 'organization' },
  { slug: 'developer', label: 'Developer', group: 'organization' },
  { slug: 'billing', label: 'Billing & Plan', group: 'organization' },
];

export const SETTINGS_BASE_PATH = '/settings';

/** The section a user lands on by default when opening Settings (AC-01). */
export const DEFAULT_SETTINGS_SLUG: SettingsSectionSlug = 'personal';

const GROUP_LABEL: Record<SettingsGroupId, string> = {
  profile: 'Profile',
  organization: 'Organization',
};

/** The deep-linkable route for a settings section. */
export function settingsPathForSlug(slug: SettingsSectionSlug): string {
  return `${SETTINGS_BASE_PATH}/${slug}`;
}

/** The section slug a /settings/* URL addresses, or undefined for an unknown/off-surface path. */
export function settingsSlugForPath(pathname: string): SettingsSectionSlug | undefined {
  const match = /^\/settings\/([^/]+)/.exec(pathname);
  const slug = match?.[1];
  return slug && SETTINGS_SECTIONS.some((section) => section.slug === slug)
    ? (slug as SettingsSectionSlug)
    : undefined;
}

/** Whether the current permission set may reach a section (mirrors the server's independent check). */
export function isSettingsSlugAuthorized(
  slug: SettingsSectionSlug,
  can: (permission: Permission) => boolean,
): boolean {
  const required = SETTINGS_SECTION_PERMISSION[slug];
  return required === null || can(required);
}

/**
 * The role-scoped SettingsNav groups for a permission predicate (from useAuthorization().can). Profile
 * items always render; an Organization item renders only when its permission is held; and the whole
 * Organization group is omitted (not merely emptied) when the user holds none of its permissions — so
 * "not rendered for Employees" (AC-02) falls straight out of the filter, no disabled state.
 */
export function settingsGroupsForPermissions(
  can: (permission: Permission) => boolean,
): SettingsNavGroup[] {
  const groups: SettingsNavGroup[] = [];
  for (const groupId of ['profile', 'organization'] as const) {
    const items = SETTINGS_SECTIONS.filter((section) => section.group === groupId)
      .filter((section) => isSettingsSlugAuthorized(section.slug, can))
      .map((section) => ({
        id: section.slug,
        label: section.label,
        href: settingsPathForSlug(section.slug),
      }));
    if (items.length > 0) {
      groups.push({ id: groupId, label: GROUP_LABEL[groupId], items });
    }
  }
  return groups;
}
