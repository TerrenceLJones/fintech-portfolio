import { describe, expect, it } from 'vitest';
import {
  defaultApprovalLimitForRole,
  hasPermission,
  permissionsForRole,
} from './authorization-policy';

describe('permissionsForRole', () => {
  it('grants an Employee only their own expenses and cards', () => {
    expect(permissionsForRole('employee', { isAdmin: false })).toEqual([
      'expenses:view',
      'cards:view',
    ]);
  });

  it('adds approvals, reconciliation and payment creation for a Finance Manager', () => {
    const perms = permissionsForRole('finance_manager', { isAdmin: false });
    expect(perms).toContain('approvals:view');
    expect(perms).toContain('approvals:act');
    expect(perms).toContain('reconciliation:view');
    expect(perms).toContain('analytics:view');
    expect(perms).toContain('payments:create');
    expect(perms).not.toContain('budget:view');
    expect(perms).not.toContain('audit:view');
  });

  it('adds budget, audit and card management for a Controller on top of Finance Manager', () => {
    const perms = permissionsForRole('controller', { isAdmin: false });
    expect(perms).toContain('approvals:act');
    expect(perms).toContain('reconciliation:view');
    expect(perms).toContain('analytics:view');
    expect(perms).toContain('payments:create');
    expect(perms).toContain('budget:view');
    expect(perms).toContain('audit:view');
    expect(perms).toContain('cards:manage');
  });

  it('does not grant payment creation to an Employee', () => {
    expect(permissionsForRole('employee', { isAdmin: false })).not.toContain('payments:create');
  });

  it('lets every role view cards but reserves card issuance/freeze (cards:manage) for a Controller', () => {
    expect(permissionsForRole('employee', { isAdmin: false })).toContain('cards:view');
    expect(permissionsForRole('finance_manager', { isAdmin: false })).toContain('cards:view');
    expect(permissionsForRole('employee', { isAdmin: false })).not.toContain('cards:manage');
    expect(permissionsForRole('finance_manager', { isAdmin: false })).not.toContain('cards:manage');
  });

  it('grants team:view for an Admin without granting any approval authority (orthogonality)', () => {
    const perms = permissionsForRole('employee', { isAdmin: true });
    expect(perms).toContain('team:view');
    expect(perms).not.toContain('approvals:view');
    expect(perms).not.toContain('approvals:act');
  });

  it('grants team:view for an Owner without granting extra approval authority (US-CW-006 AC-08)', () => {
    // An Employee who is Owner sees the Team surface but gains no approval permissions from ownership.
    const perms = permissionsForRole('employee', { isAdmin: false, isOwner: true });
    expect(perms).toContain('team:view');
    expect(perms).not.toContain('approvals:view');
    expect(perms).not.toContain('approvals:act');
  });

  it('does not grant team:view to someone who is neither Owner nor Admin, even a Controller', () => {
    expect(permissionsForRole('controller', { isAdmin: false })).not.toContain('team:view');
    expect(permissionsForRole('controller', { isAdmin: false, isOwner: false })).not.toContain(
      'team:view',
    );
  });

  it('grants a single team:view when a user is both Owner and Admin (no duplicate)', () => {
    const perms = permissionsForRole('controller', { isAdmin: true, isOwner: true });
    expect(perms.filter((p) => p === 'team:view')).toHaveLength(1);
  });

  it('never returns duplicate permissions', () => {
    const perms = permissionsForRole('controller', { isAdmin: true });
    expect(new Set(perms).size).toBe(perms.length);
  });

  // Organization-settings permissions (EPIC-CW-022 / US-CW-033).
  const ORG_CONFIG_PERMS = [
    'org-profile:manage',
    'policies:manage',
    'card-program:manage',
    'bank-accounts:manage',
    'integrations:manage',
  ] as const;
  const ADMIN_OWNER_ONLY_PERMS = [
    'org-security:manage',
    'developer:manage',
    'billing:manage',
  ] as const;

  it('grants no organization-settings permissions to an Employee or Finance Manager', () => {
    const employee = permissionsForRole('employee', { isAdmin: false });
    const manager = permissionsForRole('finance_manager', { isAdmin: false });
    for (const perm of [...ORG_CONFIG_PERMS, ...ADMIN_OWNER_ONLY_PERMS]) {
      expect(employee).not.toContain(perm);
      expect(manager).not.toContain(perm);
    }
  });

  it('grants a plain Controller the org-config set but NOT the Admin/Owner-only set', () => {
    const perms = permissionsForRole('controller', { isAdmin: false });
    for (const perm of ORG_CONFIG_PERMS) expect(perms).toContain(perm);
    for (const perm of ADMIN_OWNER_ONLY_PERMS) expect(perms).not.toContain(perm);
    // A plain Controller is not an Owner/Admin, so still no team:view (unchanged behaviour).
    expect(perms).not.toContain('team:view');
  });

  it('grants an Admin the full org set — org-config AND Admin/Owner-only — regardless of role', () => {
    const perms = permissionsForRole('employee', { isAdmin: true });
    for (const perm of [...ORG_CONFIG_PERMS, ...ADMIN_OWNER_ONLY_PERMS])
      expect(perms).toContain(perm);
  });

  it('grants an Owner the full org set even when they are not also an Admin', () => {
    const perms = permissionsForRole('controller', { isAdmin: false, isOwner: true });
    for (const perm of [...ORG_CONFIG_PERMS, ...ADMIN_OWNER_ONLY_PERMS])
      expect(perms).toContain(perm);
  });

  it('does not duplicate org permissions when a Controller is also an Admin', () => {
    const perms = permissionsForRole('controller', { isAdmin: true });
    expect(new Set(perms).size).toBe(perms.length);
  });
});

describe('defaultApprovalLimitForRole', () => {
  it('gives a Controller an unlimited approval limit', () => {
    expect(defaultApprovalLimitForRole('controller')).toBeNull();
  });

  it('gives a Finance Manager a finite default limit', () => {
    expect(defaultApprovalLimitForRole('finance_manager')).toBeGreaterThan(0);
  });

  it('gives an Employee no approval limit (they hold no approval authority)', () => {
    expect(defaultApprovalLimitForRole('employee')).toBeNull();
  });
});

describe('hasPermission', () => {
  it('is true when the permission is present', () => {
    expect(hasPermission(['expenses:view', 'approvals:view'], 'approvals:view')).toBe(true);
  });

  it('is false when the permission is absent', () => {
    expect(hasPermission(['expenses:view'], 'approvals:view')).toBe(false);
  });
});
