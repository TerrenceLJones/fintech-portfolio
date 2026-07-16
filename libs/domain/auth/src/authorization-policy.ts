import type { Permission, Role } from '@clearline/contracts';

/**
 * The approval-tier permissions each role grants, as a cumulative ladder: a Finance Manager has
 * everything an Employee has plus more, and a Controller everything a Finance Manager has plus more.
 * `team:view` is deliberately absent here — it comes only from the orthogonal Admin flag, never from
 * a role (see permissionsForRole and the design's "Employee who is also Admin" shell, US-CW-006).
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: ['expenses:view', 'cards:view'],
  finance_manager: [
    'expenses:view',
    'cards:view',
    'approvals:view',
    'approvals:act',
    'reconciliation:view',
    'payments:create',
  ],
  controller: [
    'expenses:view',
    'cards:view',
    'approvals:view',
    'approvals:act',
    'reconciliation:view',
    'payments:create',
    'budget:view',
    'audit:view',
    // Issuing virtual cards and freezing them is a Controller-only capability (US-CW-014); every
    // role can `cards:view` their own wallet, but only a Controller can `cards:manage`.
    'cards:manage',
  ],
};

/**
 * The full permission set for a user, combining their approval-tier role with the orthogonal Admin
 * flag. Admin adds `team:view` and nothing else — critically, it grants no approval authority, so an
 * Employee+Admin still can't approve. Duplicate-free even though the two sources never currently
 * overlap.
 */
export function permissionsForRole(role: Role, { isAdmin }: { isAdmin: boolean }): Permission[] {
  const rolePerms = ROLE_PERMISSIONS[role];
  const withAdmin: Permission[] = isAdmin ? [...rolePerms, 'team:view'] : [...rolePerms];
  return [...new Set(withAdmin)];
}

export function hasPermission(permissions: readonly Permission[], permission: Permission): boolean {
  return permissions.includes(permission);
}
