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
    // The spend analytics dashboard is a Finance Manager's primary monitoring surface (US-CW-015);
    // it's the role's role-based home. Controllers inherit it below.
    'analytics:view',
    'payments:create',
  ],
  controller: [
    'expenses:view',
    'cards:view',
    'approvals:view',
    'approvals:act',
    'reconciliation:view',
    'analytics:view',
    'payments:create',
    'budget:view',
    'audit:view',
    // Issuing virtual cards and freezing them is a Controller-only capability (US-CW-014); every
    // role can `cards:view` their own wallet, but only a Controller can `cards:manage`.
    'cards:manage',
  ],
};

/**
 * The full permission set for a user, combining their approval-tier role with the orthogonal
 * team-administration authority. `team:view` is granted by EITHER the Admin flag OR the Owner flag
 * (US-CW-006 AC-08 / US-CW-030 AC-02) — both sit orthogonal to the Employee/Finance Manager/Controller
 * ladder, so an Employee who is Owner or Admin sees the Team surface but gains no approval authority.
 * `team:view` is the only permission either flag adds. Duplicate-free even when a user holds both.
 */
export function permissionsForRole(
  role: Role,
  { isAdmin, isOwner = false }: { isAdmin: boolean; isOwner?: boolean },
): Permission[] {
  const rolePerms = ROLE_PERMISSIONS[role];
  const withTeam: Permission[] = isAdmin || isOwner ? [...rolePerms, 'team:view'] : [...rolePerms];
  return [...new Set(withTeam)];
}

export function hasPermission(permissions: readonly Permission[], permission: Permission): boolean {
  return permissions.includes(permission);
}

/** The default per-transaction approval limit ($10,000, minor units) a Finance Manager is provisioned with. */
const FINANCE_MANAGER_DEFAULT_LIMIT = 1_000_000;

/**
 * The approval limit (minor units; null = unlimited) a role carries by default — applied when a
 * member's tier is changed (US-CW-031 AC-04) or an invite is accepted (US-CW-031 AC-02), so the limit
 * always tracks the role rather than lingering from a previous one. A Controller is unlimited; a
 * Finance Manager gets the standard finite limit; an Employee holds no approval authority, so null.
 */
export function defaultApprovalLimitForRole(role: Role): number | null {
  if (role === 'finance_manager') return FINANCE_MANAGER_DEFAULT_LIMIT;
  return null;
}
