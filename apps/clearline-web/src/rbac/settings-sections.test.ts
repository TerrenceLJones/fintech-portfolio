import { describe, expect, it } from 'vitest';
import type { Permission } from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import {
  DEFAULT_SETTINGS_SLUG,
  isSettingsSlugAuthorized,
  settingsGroupsForPermissions,
  settingsPathForSlug,
  settingsSlugForPath,
} from './settings-sections';

function canFor(
  role: Parameters<typeof permissionsForRole>[0],
  flags: { isAdmin?: boolean; isOwner?: boolean } = {},
) {
  const perms = permissionsForRole(role, {
    isAdmin: flags.isAdmin ?? false,
    isOwner: flags.isOwner,
  });
  return (permission: Permission) => perms.includes(permission);
}

const labelsIn = (groups: ReturnType<typeof settingsGroupsForPermissions>, groupId: string) =>
  groups.find((g) => g.id === groupId)?.items.map((i) => i.label) ?? [];

describe('settingsGroupsForPermissions', () => {
  it('gives an Employee the Profile group only — no Organization group at all (AC-02)', () => {
    const groups = settingsGroupsForPermissions(canFor('employee'));
    expect(groups.map((g) => g.id)).toEqual(['profile']);
    expect(labelsIn(groups, 'profile')).toEqual(['Personal Info', 'Security', 'Notifications']);
  });

  it('gives a plain Controller the org-config sections but not the Admin/Owner-only ones (AC-03)', () => {
    const groups = settingsGroupsForPermissions(canFor('controller'));
    const org = labelsIn(groups, 'organization');
    expect(org).toContain('Company Profile');
    expect(org).toContain('Approval Policies');
    expect(org).toContain('Integrations');
    expect(org).not.toContain('Security & Compliance');
    expect(org).not.toContain('Developer');
    expect(org).not.toContain('Billing & Plan');
    // Team & Members requires team:view (Owner or Admin), which a plain Controller lacks.
    expect(org).not.toContain('Team & Members');
  });

  it('gives an Admin/Owner every Organization section including Team & Members and the Admin/Owner-only ones', () => {
    const org = labelsIn(
      settingsGroupsForPermissions(canFor('controller', { isOwner: true })),
      'organization',
    );
    expect(org).toContain('Team & Members');
    expect(org).toContain('Security & Compliance');
    expect(org).toContain('Developer');
    expect(org).toContain('Billing & Plan');
  });
});

describe('settingsSlugForPath / settingsPathForSlug', () => {
  it('round-trips a known section slug', () => {
    expect(settingsPathForSlug('billing')).toBe('/settings/billing');
    expect(settingsSlugForPath('/settings/billing')).toBe('billing');
  });

  it('resolves the active slug for a nested settings URL', () => {
    expect(settingsSlugForPath('/settings/developer/keys/new')).toBe('developer');
  });

  it('returns undefined for an unknown or off-surface path', () => {
    expect(settingsSlugForPath('/settings/not-a-section')).toBeUndefined();
    expect(settingsSlugForPath('/settings')).toBeUndefined();
    expect(settingsSlugForPath('/dashboard')).toBeUndefined();
  });
});

describe('isSettingsSlugAuthorized', () => {
  it('is always true for a Profile section and permission-gated for an Organization section', () => {
    const employee = canFor('employee');
    expect(isSettingsSlugAuthorized('personal', employee)).toBe(true);
    expect(isSettingsSlugAuthorized('billing', employee)).toBe(false);
    expect(isSettingsSlugAuthorized('billing', canFor('controller', { isAdmin: true }))).toBe(true);
  });
});

describe('DEFAULT_SETTINGS_SLUG', () => {
  it('is Personal Info — the section every user lands on (AC-01)', () => {
    expect(DEFAULT_SETTINGS_SLUG).toBe('personal');
  });
});
