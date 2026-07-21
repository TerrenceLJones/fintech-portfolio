import type { ApprovalPolicyTier, ApproverLevel, ExpenseStatus } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';

/**
 * The approval-limit tier ladder — the single policy model Settings → Approval Policies edits and the
 * expense-routing logic consumes (US-CW-037 AC-10). A tier covers the *inclusive* integer-minor-unit
 * range `minMinorUnits … maxMinorUnits` (`null` max = unlimited); a coherent policy tiles `[0, ∞)` with
 * adjacent tiers meeting at `next.min === prev.max + 1`. Everything here is pure and currency-agnostic
 * except the message formatter, which formats amounts for the gap/overlap copy.
 */

/**
 * The documented default ladder restored by "Reset to defaults" (AC-05). It reproduces the *current*
 * routing exactly — Finance Manager (L1) up to and including $10,000.00, Controller (L2) above it — so
 * lifting routing onto the editable model changes no behaviour (AC-10). Auto-approve is a supported
 * approver level an admin can add, but is deliberately not part of the default.
 */
export const DEFAULT_APPROVAL_TIERS: ApprovalPolicyTier[] = [
  {
    id: 'tier_finance_manager',
    minMinorUnits: 0,
    maxMinorUnits: 1_000_000,
    approver: 'finance_manager',
  },
  { id: 'tier_controller', minMinorUnits: 1_000_100, maxMinorUnits: null, approver: 'controller' },
];

/**
 * The granularity at which adjacent tiers are considered contiguous — one whole currency unit (100
 * minor units / $1). Boundaries are whole-dollar, so a Finance Manager tier ending at $10,000 and a
 * Controller tier starting at $10,001 are adjacent with no gap, even though $0.99 of cents sits
 * between them in minor units. Routing covers that sub-dollar band via the breakpoint model below, so
 * nothing is ever stranded.
 */
const ADJACENCY_MINOR_UNITS = 100;

const APPROVER_STATUS: Record<ApproverLevel, ExpenseStatus> = {
  auto: 'approved',
  finance_manager: 'pending_l1',
  controller: 'pending_l2',
};

/** The expense status that results from routing to a given approver level. */
export function statusForApprover(approver: ApproverLevel): ExpenseStatus {
  return APPROVER_STATUS[approver];
}

interface AmountRange {
  minMinorUnits: number;
  maxMinorUnits: number | null;
}

/**
 * The tier an amount routes to, by the *breakpoint* model: the tiers are sorted by their lower bound
 * and the amount falls to the tier with the greatest `minMinorUnits` that is still ≤ the amount — i.e.
 * each tier effectively covers `[min, nextTier.min)`. This makes routing gap-free by construction (a
 * whole-dollar boundary like $10,000 → $10,001 leaves no unrouted cents), while the declared `max`
 * fields drive the separate gap/overlap validation the admin sees. Undefined only when the amount is
 * below the first tier's floor (a no-floor policy the validator rejects).
 */
export function tierForAmount(
  amountMinorUnits: number,
  tiers: readonly ApprovalPolicyTier[],
): ApprovalPolicyTier | undefined {
  let match: ApprovalPolicyTier | undefined;
  for (const tier of tiers) {
    if (tier.minMinorUnits <= amountMinorUnits) {
      if (!match || tier.minMinorUnits > match.minMinorUnits) match = tier;
    }
  }
  return match;
}

/**
 * The routing decision for a submitted amount: the approver level and the resulting expense status.
 * When no tier matches — only possible with an incoherent policy the validator would have rejected —
 * it falls back to the Controller so an expense is never silently dropped.
 */
export function routeByTiers(
  amountMinorUnits: number,
  tiers: readonly ApprovalPolicyTier[],
): { approver: ApproverLevel; status: ExpenseStatus } {
  const approver = tierForAmount(amountMinorUnits, tiers)?.approver ?? 'controller';
  return { approver, status: statusForApprover(approver) };
}

/** Two inclusive ranges overlap iff each starts at or before the other ends. */
export function rangesOverlap(a: AmountRange, b: AmountRange): boolean {
  const aMax = a.maxMinorUnits ?? Number.POSITIVE_INFINITY;
  const bMax = b.maxMinorUnits ?? Number.POSITIVE_INFINITY;
  return a.minMinorUnits <= bMax && b.minMinorUnits <= aMax;
}

/** The first existing tier a candidate range overlaps — used for immediate inline feedback (AC-03). */
export function findOverlappingTier(
  candidate: AmountRange,
  existing: readonly ApprovalPolicyTier[],
): ApprovalPolicyTier | undefined {
  return existing.find((tier) => rangesOverlap(candidate, tier));
}

export type TierValidationIssue =
  | { kind: 'inverted'; index: number }
  | { kind: 'overlap'; index: number; withRange: AmountRange }
  | { kind: 'gap'; fromMinorUnits: number; toMinorUnits: number }
  | { kind: 'no-floor'; firstMinMinorUnits: number }
  | { kind: 'no-ceiling'; lastMaxMinorUnits: number };

export type ApprovalTiersValidation =
  { ok: true; tiers: ApprovalPolicyTier[] } | { ok: false; issues: TierValidationIssue[] };

/**
 * Validates that a set of tiers is a coherent policy the routing can consume without ambiguity: every
 * range well-formed, no overlaps, no gaps, starting at $0 and ending unlimited (AC-01/03/04). Run before
 * every save so an administrator can never persist a policy that would strand an expense (AC-10). Issues
 * carry raw minor-unit operands; {@link formatTierIssue} composes the specific user-facing message.
 */
export function validateApprovalTiers(
  tiers: readonly ApprovalPolicyTier[],
): ApprovalTiersValidation {
  const issues: TierValidationIssue[] = [];

  // Per-tier well-formedness first: an inverted or zero-width range (max ≤ min) is not a range at all.
  tiers.forEach((tier, index) => {
    if (tier.maxMinorUnits !== null && tier.maxMinorUnits <= tier.minMinorUnits) {
      issues.push({ kind: 'inverted', index });
    }
  });

  const sorted = [...tiers].sort((a, b) => a.minMinorUnits - b.minMinorUnits);

  const first = sorted[0];
  if (first && first.minMinorUnits !== 0) {
    issues.push({ kind: 'no-floor', firstMinMinorUnits: first.minMinorUnits });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!current || !next) continue;
    // An unlimited tier that isn't last, or a next tier starting at/under the current max, overlaps.
    // Boundaries are whole-dollar, so a next tier starting within one dollar of the current max is
    // adjacent (no gap); a larger jump is a real coverage gap the admin must close (AC-04).
    if (current.maxMinorUnits === null || next.minMinorUnits <= current.maxMinorUnits) {
      issues.push({ kind: 'overlap', index: i + 1, withRange: current });
    } else if (next.minMinorUnits > current.maxMinorUnits + ADJACENCY_MINOR_UNITS) {
      issues.push({
        kind: 'gap',
        fromMinorUnits: current.maxMinorUnits,
        toMinorUnits: next.minMinorUnits,
      });
    }
  }

  const last = sorted[sorted.length - 1];
  if (last && last.maxMinorUnits !== null) {
    issues.push({ kind: 'no-ceiling', lastMaxMinorUnits: last.maxMinorUnits });
  }

  return issues.length === 0 ? { ok: true, tiers: sorted } : { ok: false, issues };
}

/** Formats a minor-unit amount as a currency string, dropping the decimals when it is a whole amount. */
function formatAmount(minorUnits: number, currency: string): string {
  const major = toMajorUnits({ amountMinorUnits: minorUnits, currency });
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
  }).format(major);
}

/** Formats an inclusive tier range as "$min–$max" (or "$min+" for the unlimited top tier). */
export function formatTierRange(range: AmountRange, currency = 'USD'): string {
  const min = formatAmount(range.minMinorUnits, currency);
  if (range.maxMinorUnits === null) return `${min}+`;
  return `${min}–${formatAmount(range.maxMinorUnits, currency)}`;
}

/** The specific, name-the-thing message for a validation issue (AC-03/AC-04). */
export function formatTierIssue(issue: TierValidationIssue, currency = 'USD'): string {
  switch (issue.kind) {
    case 'overlap':
      return `This range overlaps with an existing tier (${formatTierRange(issue.withRange, currency)}). Adjust the amounts to eliminate the overlap.`;
    case 'gap':
      return `Your policy has a gap between ${formatAmount(issue.fromMinorUnits, currency)} and ${formatAmount(issue.toMinorUnits, currency)}. Expenses in this range won't route correctly.`;
    case 'inverted':
      return "A tier's maximum must be greater than its minimum.";
    case 'no-floor':
      return `The first tier must start at ${formatAmount(0, currency)}.`;
    case 'no-ceiling':
      return 'The top tier must be unlimited so every amount routes to an approver.';
  }
}
