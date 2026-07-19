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
 * Organization-configuration permissions granted to a Controller OR any Admin/Owner (EPIC-CW-022 /
 * US-CW-033). These back the Settings → Organization sections that a Controller can manage.
 */
const ORG_CONFIG_PERMISSIONS: readonly Permission[] = [
  'org-profile:manage',
  'policies:manage',
  'card-program:manage',
  'bank-accounts:manage',
  'integrations:manage',
];

/**
 * The most sensitive Organization-settings permissions — security & compliance, developer keys, and
 * billing — reserved for an Admin or Owner (never a plain Controller), per US-CW-033 AC-03.
 */
const ADMIN_OWNER_ONLY_PERMISSIONS: readonly Permission[] = [
  'org-security:manage',
  'developer:manage',
  'billing:manage',
];

/**
 * The full permission set for a user, combining their approval-tier role with the orthogonal
 * team-administration authority and the organization-settings capabilities. `team:view` is granted by
 * EITHER the Admin flag OR the Owner flag (US-CW-006 AC-08 / US-CW-030 AC-02) — both sit orthogonal to
 * the Employee/Finance Manager/Controller ladder, so an Employee who is Owner or Admin sees the Team
 * surface but gains no approval authority. The org-config set is granted to a Controller or any
 * Admin/Owner; the Admin/Owner-only set only to an Admin or Owner (EPIC-CW-022 / US-CW-033).
 * Duplicate-free even when a user holds several of these overlapping grants.
 */
export function permissionsForRole(
  role: Role,
  { isAdmin, isOwner = false }: { isAdmin: boolean; isOwner?: boolean },
): Permission[] {
  const perms: Permission[] = [...ROLE_PERMISSIONS[role]];
  if (isAdmin || isOwner) perms.push('team:view');
  if (role === 'controller' || isAdmin || isOwner) perms.push(...ORG_CONFIG_PERMISSIONS);
  if (isAdmin || isOwner) perms.push(...ADMIN_OWNER_ONLY_PERMISSIONS);
  return [...new Set(perms)];
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
