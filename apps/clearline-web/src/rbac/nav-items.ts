import type { Permission } from '@clearline/contracts';
import type { IconName } from '@clearline/icons';
import type { NavigationShellItem } from '@clearline/ui';

/**
 * The full navigation catalogue and the single permission each entry requires. US-CW-006 owns the
 * role→permission decision (in @clearline/domain-auth); this table owns only the app-layer concerns
 * US-CW-028 deliberately keeps out of the presentational NavigationShell — labels, icons, and routes.
 * The order here is the order links appear in the shell.
 */
export interface NavItemDef {
  id: string;
  permission: Permission;
  label: string;
  icon: IconName;
  path: string;
}

export const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'expenses',
    permission: 'expenses:view',
    label: 'My Expenses',
    icon: 'file-text',
    path: '/expenses',
  },
  { id: 'cards', permission: 'cards:view', label: 'My Cards', icon: 'copy', path: '/cards' },
  {
    id: 'approvals',
    permission: 'approvals:view',
    label: 'Approvals',
    icon: 'check',
    path: '/approvals',
  },
  {
    id: 'payments',
    permission: 'payments:create',
    label: 'Payments',
    icon: 'arrow-right-circle',
    path: '/payments/new',
  },
  {
    id: 'reconciliation',
    permission: 'reconciliation:view',
    label: 'Reconciliation',
    icon: 'refresh',
    path: '/reconciliation',
  },
  {
    id: 'budget',
    permission: 'budget:view',
    label: 'Budget Management',
    icon: 'bar-chart',
    path: '/budget',
  },
  { id: 'audit', permission: 'audit:view', label: 'Audit Log', icon: 'clock', path: '/audit' },
  { id: 'team', permission: 'team:view', label: 'Team', icon: 'users', path: '/team' },
];

/**
 * The page a user lands on after login, chosen by role (US-CW-001). Approvers (Finance Managers /
 * Controllers, who hold approvals:view) land on their approval queue — their primary work surface;
 * everyone else lands on My Expenses. Permission-driven rather than role-string-driven, consistent
 * with the rest of the app's authorization model.
 */
export function homePathForPermissions(can: (permission: Permission) => boolean): string {
  if (can('approvals:view')) return '/approvals';
  return '/expenses';
}

/** The role-scoped nav items to render, given a permission predicate (from useAuthorization().can). */
export function navItemsForPermissions(
  can: (permission: Permission) => boolean,
): NavigationShellItem[] {
  return NAV_ITEMS.filter((item) => can(item.permission)).map(({ id, icon, label }) => ({
    id,
    icon,
    label,
  }));
}

/** Route path for a nav id (for onNavigate). */
export function navPathForId(id: string): string | undefined {
  return NAV_ITEMS.find((item) => item.id === id)?.path;
}

/**
 * The active nav id for a URL. Exact match wins; otherwise the longest non-root path that prefixes
 * the URL, so a nested route (e.g. /approvals/exp_1) still highlights its section without "/" ever
 * greedily matching everything.
 */
export function navIdForPath(pathname: string): string | undefined {
  const exact = NAV_ITEMS.find((item) => item.path === pathname);
  if (exact) return exact.id;
  const prefixMatch = NAV_ITEMS.filter(
    (item) => item.path !== '/' && pathname.startsWith(`${item.path}/`),
  ).sort((a, b) => b.path.length - a.path.length)[0];
  return prefixMatch?.id;
}
