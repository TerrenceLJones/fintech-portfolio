import { describe, expect, it } from 'vitest';
import type { Permission } from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import {
  homePathForPermissions,
  navIdForPath,
  navItemsForPermissions,
  navPathForId,
} from './nav-items';

function canFor(role: Parameters<typeof permissionsForRole>[0], isAdmin = false) {
  const perms = permissionsForRole(role, { isAdmin });
  return (permission: Permission) => perms.includes(permission);
}

describe('navItemsForPermissions', () => {
  it('gives an Employee only My Expenses and My Cards, plus the universal Settings entry (US-CW-006 AC-01 / US-CW-033)', () => {
    const items = navItemsForPermissions(canFor('employee'));
    expect(items.map((i) => i.label)).toEqual(['My Expenses', 'My Cards', 'Settings']);
  });

  it('always includes the permission-less Settings entry, even for an Employee (US-CW-028 update)', () => {
    expect(navItemsForPermissions(canFor('employee')).map((i) => i.id)).toContain('settings');
    expect(navItemsForPermissions(canFor('controller', true)).map((i) => i.id)).toContain(
      'settings',
    );
  });

  it('gives a Finance Manager the Dashboard plus Approvals, Reconciliation and Payments (AC-02)', () => {
    const labels = navItemsForPermissions(canFor('finance_manager')).map((i) => i.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Approvals');
    expect(labels).toContain('Reconciliation');
    expect(labels).toContain('Payments');
    expect(labels).not.toContain('Budget Management');
    expect(labels).not.toContain('Audit Log');
  });

  it('does not give an Employee the Dashboard link (analytics:view, US-CW-015)', () => {
    expect(navItemsForPermissions(canFor('employee')).map((i) => i.label)).not.toContain(
      'Dashboard',
    );
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

  it('does not add a primary-nav Team item for an Admin — Team & Members moved into Settings (US-CW-033)', () => {
    const labels = navItemsForPermissions(canFor('employee', true)).map((i) => i.label);
    // Team & Members is now reached via Settings → Team & Members (/settings/team), not the primary rail.
    expect(labels).not.toContain('Team');
    expect(labels).toContain('Settings');
    // Orthogonality preserved: an Admin still gains no approval links.
    expect(labels).not.toContain('Approvals');
  });
});

describe('homePathForPermissions', () => {
  it('sends an Employee to My Expenses (US-CW-001)', () => {
    expect(homePathForPermissions(canFor('employee'))).toBe('/expenses');
  });

  it('sends a Finance Manager / Controller to the spend dashboard (US-CW-015)', () => {
    expect(homePathForPermissions(canFor('finance_manager'))).toBe('/dashboard');
    expect(homePathForPermissions(canFor('controller'))).toBe('/dashboard');
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

  it('maps the My Expenses link to the expenses route', () => {
    expect(navPathForId('expenses')).toBe('/expenses');
    expect(navIdForPath('/expenses')).toBe('expenses');
  });

  it('highlights the section for a nested route without "/" matching everything', () => {
    expect(navIdForPath('/approvals/exp_4471')).toBe('approvals');
    expect(navIdForPath('/expenses/new')).toBe('expenses');
  });

  it('maps Budget Management to /budgets and highlights its nested routes (US-CW-019)', () => {
    expect(navPathForId('budget')).toBe('/budgets');
    expect(navIdForPath('/budgets')).toBe('budget');
    expect(navIdForPath('/budgets/new')).toBe('budget');
    expect(navIdForPath('/budgets/engineering/history')).toBe('budget');
  });

  it('returns undefined for an unknown path', () => {
    expect(navIdForPath('/nowhere')).toBeUndefined();
  });
});
