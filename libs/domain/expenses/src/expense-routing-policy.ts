import type { ExpenseStatus } from '@clearline/contracts';
import { DEFAULT_APPROVAL_TIERS, routeByTiers } from './approval-tier-policy';

/**
 * The amount at or under which a submitted expense routes to a first-tier (L1) approver under the
 * *default* policy — derived from the default ladder's Finance Manager tier rather than hardcoded, so
 * there is one source of truth (US-CW-037 AC-10). Above it, the expense exceeds a Finance Manager's
 * standard $10,000.00 limit and routes to a Controller (L2). Kept for callers/tests that reason about
 * the default boundary; the live routing reads the org's persisted tiers via {@link routeByTiers}.
 */
export const L2_ROUTING_THRESHOLD_MINOR_UNITS: number =
  DEFAULT_APPROVAL_TIERS.find((tier) => tier.approver === 'finance_manager')?.maxMinorUnits ?? 0;

/**
 * The pending status a freshly-submitted expense enters under the default policy, decided by amount.
 * Thin wrapper over {@link routeByTiers} against {@link DEFAULT_APPROVAL_TIERS}; the mock backend routes
 * against the org's edited tiers instead, so editing the policy in Settings changes routing directly.
 */
export function routeSubmittedStatus(
  amountMinorUnits: number,
): Extract<ExpenseStatus, 'pending_l1' | 'pending_l2'> {
  const { status } = routeByTiers(amountMinorUnits, DEFAULT_APPROVAL_TIERS);
  // The default ladder has no auto-approve tier, so the result is always a pending status.
  return status === 'pending_l2' ? 'pending_l2' : 'pending_l1';
}
