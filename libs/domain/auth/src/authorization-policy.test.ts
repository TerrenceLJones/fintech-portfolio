import { describe, expect, it } from 'vitest';
import { hasPermission, permissionsForRole } from './authorization-policy';

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
    expect(perms).toContain('payments:create');
    expect(perms).not.toContain('budget:view');
    expect(perms).not.toContain('audit:view');
  });

  it('adds budget and audit for a Controller on top of Finance Manager', () => {
    const perms = permissionsForRole('controller', { isAdmin: false });
    expect(perms).toContain('approvals:act');
    expect(perms).toContain('reconciliation:view');
    expect(perms).toContain('payments:create');
    expect(perms).toContain('budget:view');
    expect(perms).toContain('audit:view');
  });

  it('does not grant payment creation to an Employee', () => {
    expect(permissionsForRole('employee', { isAdmin: false })).not.toContain('payments:create');
  });

  it('grants team:view for an Admin without granting any approval authority (orthogonality)', () => {
    const perms = permissionsForRole('employee', { isAdmin: true });
    expect(perms).toContain('team:view');
    expect(perms).not.toContain('approvals:view');
    expect(perms).not.toContain('approvals:act');
  });

  it('does not grant team:view to a non-Admin, even a Controller', () => {
    expect(permissionsForRole('controller', { isAdmin: false })).not.toContain('team:view');
  });

  it('never returns duplicate permissions', () => {
    const perms = permissionsForRole('controller', { isAdmin: true });
    expect(new Set(perms).size).toBe(perms.length);
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
