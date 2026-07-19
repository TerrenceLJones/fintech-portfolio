import { describe, expect, it } from 'vitest';
import { permissionsForRole } from './authorization-policy';
import {
  SETTINGS_SECTION_PERMISSION,
  authorizedSettingsSections,
  permissionForSettingsSection,
} from './settings-sections-policy';

describe('SETTINGS_SECTION_PERMISSION', () => {
  it('requires no permission for the three Profile sections', () => {
    expect(SETTINGS_SECTION_PERMISSION.personal).toBeNull();
    expect(SETTINGS_SECTION_PERMISSION.security).toBeNull();
    expect(SETTINGS_SECTION_PERMISSION.notifications).toBeNull();
  });

  it('maps each Organization section to its required permission', () => {
    expect(SETTINGS_SECTION_PERMISSION.company).toBe('org-profile:manage');
    expect(SETTINGS_SECTION_PERMISSION['approval-policies']).toBe('policies:manage');
    expect(SETTINGS_SECTION_PERMISSION['spend-controls']).toBe('policies:manage');
    expect(SETTINGS_SECTION_PERMISSION['card-program']).toBe('card-program:manage');
    expect(SETTINGS_SECTION_PERMISSION['connected-accounts']).toBe('bank-accounts:manage');
    expect(SETTINGS_SECTION_PERMISSION.integrations).toBe('integrations:manage');
    expect(SETTINGS_SECTION_PERMISSION['org-notifications']).toBe('integrations:manage');
    expect(SETTINGS_SECTION_PERMISSION['security-compliance']).toBe('org-security:manage');
    expect(SETTINGS_SECTION_PERMISSION.developer).toBe('developer:manage');
    expect(SETTINGS_SECTION_PERMISSION.billing).toBe('billing:manage');
  });
});

describe('permissionForSettingsSection', () => {
  it('returns null for a Profile section and the token for an Organization section', () => {
    expect(permissionForSettingsSection('personal')).toBeNull();
    expect(permissionForSettingsSection('billing')).toBe('billing:manage');
  });

  it('returns undefined for an unknown slug (so the caller can 404)', () => {
    expect(permissionForSettingsSection('nope')).toBeUndefined();
  });
});

describe('authorizedSettingsSections', () => {
  it('gives an Employee only the Profile sections', () => {
    const perms = permissionsForRole('employee', { isAdmin: false });
    expect(authorizedSettingsSections(perms)).toEqual(['personal', 'security', 'notifications']);
  });

  it('adds the org-config sections for a plain Controller but not the Admin/Owner-only ones', () => {
    const sections = authorizedSettingsSections(
      permissionsForRole('controller', { isAdmin: false }),
    );
    expect(sections).toContain('company');
    expect(sections).toContain('approval-policies');
    expect(sections).toContain('integrations');
    expect(sections).not.toContain('security-compliance');
    expect(sections).not.toContain('developer');
    expect(sections).not.toContain('billing');
    // Team & Members needs team:view (Owner or Admin) — a plain Controller doesn't get it.
    expect(sections).not.toContain('team');
  });

  it('adds every section — including Team & Members — for an Admin/Owner', () => {
    const sections = authorizedSettingsSections(
      permissionsForRole('controller', { isAdmin: false, isOwner: true }),
    );
    expect(sections).toContain('team');
    expect(sections).toContain('security-compliance');
    expect(sections).toContain('developer');
    expect(sections).toContain('billing');
  });
});
