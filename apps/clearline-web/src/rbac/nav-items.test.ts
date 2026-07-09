import { describe, expect, it } from 'vitest';
import type { Permission } from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import { navIdForPath, navItemsForPermissions, navPathForId } from './nav-items';

function canFor(role: Parameters<typeof permissionsForRole>[0], isAdmin = false) {
  const perms = permissionsForRole(role, { isAdmin });
  return (permission: Permission) => perms.includes(permission);
}

describe('navItemsForPermissions', () => {
  it('gives an Employee only My Expenses and My Cards (US-CW-006 AC-01)', () => {
    const items = navItemsForPermissions(canFor('employee'));
    expect(items.map((i) => i.label)).toEqual(['My Expenses', 'My Cards']);
  });

  it('gives a Finance Manager expenses/cards plus Approvals, Reconciliation and Payments (AC-02)', () => {
    const labels = navItemsForPermissions(canFor('finance_manager')).map((i) => i.label);
    expect(labels).toContain('Approvals');
    expect(labels).toContain('Reconciliation');
    expect(labels).toContain('Payments');
    expect(labels).not.toContain('Budget Management');
    expect(labels).not.toContain('Audit Log');
  });

  it('does not give an Employee the Payments link (EPIC-CW-004)', () => {
    expect(navItemsForPermissions(canFor('employee')).map((i) => i.label)).not.toContain(
      'Payments',
    );
  });

  it('gives a Controller all Finance Manager links plus Budget and Audit (AC-03)', () => {
    const labels = navItemsForPermissions(canFor('controller')).map((i) => i.label);
    expect(labels).toContain('Budget Management');
    expect(labels).toContain('Audit Log');
  });

  it('adds Team for an Admin without any approval links (orthogonality)', () => {
    const labels = navItemsForPermissions(canFor('employee', true)).map((i) => i.label);
    expect(labels).toContain('Team');
    expect(labels).not.toContain('Approvals');
  });
});

describe('navPathForId / navIdForPath', () => {
  it('maps an id to its path and back', () => {
    expect(navPathForId('approvals')).toBe('/approvals');
    expect(navIdForPath('/approvals')).toBe('approvals');
  });

  it('maps the Payments link to the New Payment route', () => {
    expect(navPathForId('payments')).toBe('/payments/new');
    expect(navIdForPath('/payments/new')).toBe('payments');
  });

  it('resolves the home path to expenses', () => {
    expect(navIdForPath('/')).toBe('expenses');
  });

  it('highlights the section for a nested route without "/" matching everything', () => {
    expect(navIdForPath('/approvals/exp_4471')).toBe('approvals');
  });

  it('returns undefined for an unknown path', () => {
    expect(navIdForPath('/nowhere')).toBeUndefined();
  });
});
