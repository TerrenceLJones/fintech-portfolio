import type { Role } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';

/**
 * App-layer presentation of the live session identity for the sidebar footer (US-CW-032). These are pure display mappers — they read the session values useAuthorization() already exposes and format them; they own no authorization decision (that stays in @clearline/domain-auth via US-CW-006).
 */
const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/** The human-readable role name shown in the identity footer. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Avatar initials — the first letter of each of the first two words, uppercased (e.g. "Priya Nair" -> "PN"). */
export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

/**
 * A compact currency string for a minor-units approval limit (e.g. 1_000_000 -> "$10k"), matching
 * design §3.1. The currency is passed in — the approval limit is denominated in the organization's
 * currency (server-sourced, single-currency per @clearline/contracts), never assumed here.
 *
 * One fractional digit is allowed so a non-round limit stays accurate rather than rounding to a
 * misleading whole unit — $10,000 renders "$10k" (no spurious decimal) while $2,500 renders "$2.5k"
 * and $10,500 renders "$10.5k", so an approver never reads a limit higher than the one they hold.
 */
function compactLimit(approvalLimitMinorUnits: number, currency: string): string {
  const major = toMajorUnits({ amountMinorUnits: approvalLimitMinorUnits, currency });
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
    .format(major)
    .toLowerCase();
}

/**
 * The footer's secondary detail beside the role: the approver's authority ("$10k limit" for a
 * Finance Manager, "Unlimited" for a Controller, nothing for an Employee) with an "Admin" indicator
 * appended where applicable (US-CW-032 AC-04). Returns null when there is nothing to show — e.g. a
 * plain Employee, or a Finance Manager whose limit (or its organization currency) has not loaded yet.
 *
 * `currency` is the organization's currency for the numeric approval limit; when it is not yet
 * available the numeric limit is withheld (rather than guessing a currency) — "Unlimited" and the
 * Admin indicator, which need no currency, still render.
 */
export function identityDetail(
  role: Role,
  approvalLimit: number | null,
  isAdmin: boolean,
  currency: string | undefined,
): string | null {
  const authority =
    role === 'controller'
      ? 'Unlimited'
      : role === 'finance_manager' && approvalLimit !== null && currency
        ? `${compactLimit(approvalLimit, currency)} limit`
        : null;

  const parts = [authority, isAdmin ? 'Admin' : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
