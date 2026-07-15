import type { ExpenseStatus } from '@clearline/contracts';

/**
 * The amount at or under which a submitted expense routes to a first-tier (L1) approver. Above it,
 * the expense exceeds a Finance Manager's standard $10,000.00 limit and routes straight to a
 * Controller (L2) at submit time (US-CW-012 AC-04). "Exceeds" is strict, so an expense at exactly the
 * limit stays L1 (the boundary edge case). Mirrors @clearline/domain-auth's approval-limit rule.
 */
export const L2_ROUTING_THRESHOLD_MINOR_UNITS = 1_000_000;

/** The pending status a freshly-submitted expense enters, decided by amount against the L1 approver's limit. */
export function routeSubmittedStatus(
  amountMinorUnits: number,
): Extract<ExpenseStatus, 'pending_l1' | 'pending_l2'> {
  return amountMinorUnits > L2_ROUTING_THRESHOLD_MINOR_UNITS ? 'pending_l2' : 'pending_l1';
}
