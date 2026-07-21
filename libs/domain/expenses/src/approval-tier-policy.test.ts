import { describe, expect, it } from 'vitest';
import type { ApprovalPolicyTier } from '@clearline/contracts';
import {
  DEFAULT_APPROVAL_TIERS,
  findOverlappingTier,
  formatTierIssue,
  routeByTiers,
  statusForApprover,
  tierForAmount,
  validateApprovalTiers,
} from './approval-tier-policy';

/** A small tier builder so tests read as ranges, not object literals. */
function tier(
  minMinorUnits: number,
  maxMinorUnits: number | null,
  approver: ApprovalPolicyTier['approver'],
  id = `t_${minMinorUnits}`,
): ApprovalPolicyTier {
  return { id, minMinorUnits, maxMinorUnits, approver };
}

describe('DEFAULT_APPROVAL_TIERS', () => {
  it('is a coherent policy that tiles [$0, ∞)', () => {
    const result = validateApprovalTiers(DEFAULT_APPROVAL_TIERS);
    expect(result.ok).toBe(true);
  });

  it('routes by the default whole-dollar boundary — $10,000 to L1, $10,001 to L2 (AC-10)', () => {
    // Finance Manager owns the $0–$10,000 band; the Controller tier starts at the next whole dollar.
    expect(routeByTiers(1_000_000, DEFAULT_APPROVAL_TIERS).status).toBe('pending_l1');
    expect(routeByTiers(1_000_050, DEFAULT_APPROVAL_TIERS).status).toBe('pending_l1');
    expect(routeByTiers(1_000_100, DEFAULT_APPROVAL_TIERS).status).toBe('pending_l2');
    expect(routeByTiers(30_000, DEFAULT_APPROVAL_TIERS).status).toBe('pending_l1');
    expect(routeByTiers(2_500_000, DEFAULT_APPROVAL_TIERS).status).toBe('pending_l2');
  });
});

describe('statusForApprover', () => {
  it('maps each approver level to the resulting expense status', () => {
    expect(statusForApprover('auto')).toBe('approved');
    expect(statusForApprover('finance_manager')).toBe('pending_l1');
    expect(statusForApprover('controller')).toBe('pending_l2');
  });
});

describe('routeByTiers', () => {
  const tiers = [
    tier(0, 99_999, 'auto'),
    tier(100_000, 1_000_000, 'finance_manager'),
    tier(1_000_001, null, 'controller'),
  ];

  it('auto-approves an amount in an auto-approve tier', () => {
    expect(routeByTiers(50_000, tiers)).toEqual({ approver: 'auto', status: 'approved' });
  });

  it('routes by the tier whose inclusive range covers the amount', () => {
    expect(routeByTiers(100_000, tiers).approver).toBe('finance_manager');
    expect(routeByTiers(1_000_000, tiers).approver).toBe('finance_manager');
    expect(routeByTiers(1_000_001, tiers).approver).toBe('controller');
  });

  it('falls back to the controller (never drops an expense) when no tier matches', () => {
    expect(routeByTiers(500, [tier(100_000, null, 'finance_manager')])).toEqual({
      approver: 'controller',
      status: 'pending_l2',
    });
  });
});

describe('tierForAmount', () => {
  it('returns the covering tier, or undefined when uncovered', () => {
    const tiers = [tier(0, 1_000_000, 'finance_manager'), tier(1_000_001, null, 'controller')];
    expect(tierForAmount(500, tiers)?.approver).toBe('finance_manager');
    expect(tierForAmount(9_999_999, tiers)?.approver).toBe('controller');
    expect(tierForAmount(-1, tiers)).toBeUndefined();
  });
});

describe('validateApprovalTiers', () => {
  it('accepts a contiguous [$0, ∞) tiling', () => {
    const result = validateApprovalTiers([
      tier(0, 99_999, 'auto'),
      tier(100_000, 999_999, 'finance_manager'),
      tier(1_000_000, null, 'controller'),
    ]);
    expect(result.ok).toBe(true);
  });

  it('flags an overlapping tier (AC-03)', () => {
    // $1,000–$10,000 finance_manager and a new $5,000–$25,000 controller overlap.
    const result = validateApprovalTiers([
      tier(0, 99_999, 'auto'),
      tier(100_000, 1_000_000, 'finance_manager'),
      tier(500_000, 2_500_000, 'controller'),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.kind === 'overlap')).toBe(true);
  });

  it('treats whole-dollar-adjacent tiers as contiguous, not a gap ($9,000 then $9,001)', () => {
    // Regression: a Finance Manager tier ending at $9,000 and a Controller tier starting at $9,001 are
    // adjacent in whole dollars, even though 99 cents sit between them in minor units.
    const result = validateApprovalTiers([
      tier(0, 900_000, 'finance_manager'),
      tier(900_100, null, 'controller'),
    ]);
    expect(result.ok).toBe(true);
    // And the cents in between still route — to the lower (Finance Manager) tier.
    expect(
      routeByTiers(900_050, [
        tier(0, 900_000, 'finance_manager'),
        tier(900_100, null, 'controller'),
      ]).status,
    ).toBe('pending_l1');
  });

  it('flags a coverage gap and names its bounds (AC-04)', () => {
    // $0–$1,000 then $10,001–unlimited → a gap between $1,000 and $10,001.
    const result = validateApprovalTiers([
      tier(0, 100_000, 'finance_manager'),
      tier(1_000_100, null, 'controller'),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const gap = result.issues.find((i) => i.kind === 'gap');
    expect(gap).toMatchObject({ fromMinorUnits: 100_000, toMinorUnits: 1_000_100 });
  });

  it('rejects an inverted or zero-width range (max ≤ min)', () => {
    const result = validateApprovalTiers([
      tier(0, 100_000, 'finance_manager'),
      tier(100_001, 100_000, 'controller'),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.kind === 'inverted')).toBe(true);
  });

  it('requires the first tier to start at $0 (no floor)', () => {
    const result = validateApprovalTiers([tier(100_000, null, 'finance_manager')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.kind === 'no-floor')).toBe(true);
  });

  it('requires the top tier to be unlimited (no ceiling)', () => {
    const result = validateApprovalTiers([tier(0, 1_000_000, 'finance_manager')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.kind === 'no-ceiling')).toBe(true);
  });
});

describe('findOverlappingTier', () => {
  it('returns the first existing tier a candidate range overlaps, else undefined', () => {
    const existing = [tier(100_000, 1_000_000, 'finance_manager', 'fm')];
    expect(
      findOverlappingTier({ minMinorUnits: 500_000, maxMinorUnits: 2_500_000 }, existing)?.id,
    ).toBe('fm');
    expect(
      findOverlappingTier({ minMinorUnits: 1_000_001, maxMinorUnits: 5_000_000 }, existing),
    ).toBeUndefined();
  });
});

describe('formatTierIssue', () => {
  it('renders the AC-03 overlap copy naming the existing range', () => {
    const message = formatTierIssue(
      {
        kind: 'overlap',
        index: 2,
        withRange: { minMinorUnits: 100_000, maxMinorUnits: 1_000_000 },
      },
      'USD',
    );
    expect(message).toBe(
      'This range overlaps with an existing tier ($1,000–$10,000). Adjust the amounts to eliminate the overlap.',
    );
  });

  it('renders the AC-04 gap copy naming the bounds', () => {
    const message = formatTierIssue(
      { kind: 'gap', fromMinorUnits: 100_000, toMinorUnits: 1_000_100 },
      'USD',
    );
    expect(message).toBe(
      "Your policy has a gap between $1,000 and $10,001. Expenses in this range won't route correctly.",
    );
  });
});
