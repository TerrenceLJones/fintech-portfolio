import type { Money } from '@clearline/contracts';

/** USD helper for the seed — every analytics amount is USD minor units (cents). */
function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: 'USD' };
}

/**
 * A single seeded spend transaction. Category / department / vendor breakdowns and the summary total
 * are all *derived* from these by AnalyticsService — one source of truth, so a date-range filter that
 * excludes every transaction naturally yields an empty dashboard (US-CW-015 AC-03) rather than needing
 * a second, separately-maintained "is empty" flag.
 */
export interface SeedTransaction {
  id: string;
  vendor: string;
  category: string;
  department: string;
  /** ISO-8601 date (YYYY-MM-DD) — lexicographically comparable, so range filtering is a string compare. */
  date: string;
  amount: Money;
  /** Present on the one deliberately-anomalous row (WeWork), shaped to exercise AC-02. */
  anomaly?: { confidencePercent: number; normalAmount: Money };
}

/**
 * The seeded spend for June 2026 — the demo's default range. Amounts and vendors are chosen so the
 * derived breakdowns read like the design's §9.1 dashboard: Gusto/Payroll dominates, then Software
 * (AWS, Figma, …), and the WeWork Office charge is flagged as an unusual amount at 87% confidence.
 * A range with no matching dates (e.g. Jul 1–7) returns nothing, which the client renders as the
 * empty state.
 */
export const SEED_SPEND_TRANSACTIONS: SeedTransaction[] = [
  {
    id: 'txn_9001',
    vendor: 'Gusto',
    category: 'Payroll & Benefits',
    department: 'Operations',
    date: '2026-06-28',
    amount: usd(18_620_000),
  },
  {
    id: 'txn_9002',
    vendor: 'Amazon Web Services',
    category: 'Software',
    department: 'Engineering',
    date: '2026-06-28',
    amount: usd(4_821_000),
  },
  {
    id: 'txn_9003',
    vendor: 'Figma',
    category: 'Software',
    department: 'Design',
    date: '2026-06-27',
    amount: usd(1_292_000),
  },
  {
    id: 'txn_9004',
    vendor: 'WeWork',
    category: 'Office & Facilities',
    department: 'Operations',
    date: '2026-06-26',
    amount: usd(4_240_000),
    // Normally ~$11,000 for this vendor — a 4x deviation the model flags with high confidence (AC-02).
    anomaly: { confidencePercent: 87, normalAmount: usd(1_100_000) },
  },
  {
    id: 'txn_9005',
    vendor: 'Google Ads',
    category: 'Marketing',
    department: 'Marketing',
    date: '2026-06-22',
    amount: usd(2_860_000),
  },
  {
    id: 'txn_9006',
    vendor: 'LinkedIn Ads',
    category: 'Marketing',
    department: 'Marketing',
    date: '2026-06-21',
    amount: usd(1_100_000),
  },
  {
    id: 'txn_9007',
    vendor: 'United Airlines',
    category: 'Travel',
    department: 'Sales',
    date: '2026-06-18',
    amount: usd(1_240_000),
  },
  {
    id: 'txn_9008',
    vendor: 'Notion Labs',
    category: 'Software',
    department: 'Engineering',
    date: '2026-06-15',
    amount: usd(480_000),
  },
  {
    id: 'txn_9009',
    vendor: 'Slack',
    category: 'Software',
    department: 'Engineering',
    date: '2026-06-12',
    amount: usd(720_000),
  },
  {
    id: 'txn_9010',
    vendor: 'Delta Air Lines',
    category: 'Travel',
    department: 'Sales',
    date: '2026-06-10',
    amount: usd(980_000),
  },
  {
    id: 'txn_9011',
    vendor: 'Staples',
    category: 'Office & Facilities',
    department: 'Operations',
    date: '2026-06-08',
    amount: usd(340_000),
  },
  {
    id: 'txn_9012',
    vendor: 'Gusto',
    category: 'Payroll & Benefits',
    department: 'Operations',
    date: '2026-06-05',
    amount: usd(1_800_000),
  },
];

/**
 * Range-independent KPIs the dashboard shows alongside the derived spend total. In a real system these
 * come from the approvals queue and card ledger; here they're seed constants matching the design's
 * pending-approvals (7 · $48,210) and card (24 active · 3 frozen) tiles. Budget figures are demo
 * projections, surfaced with a "DERIVED · READ-ONLY" chip.
 */
export const SEED_ANALYTICS_KPIS = {
  pendingApprovalsCount: 7,
  pendingApprovalsAmount: usd(4_821_000),
  budgetRemaining: usd(14_200_000),
  budgetTotal: usd(62_900_000),
  activeCards: 24,
  frozenCards: 3,
} as const;

/** The seeded default range the dashboard opens on, and the "Reset" target for the empty state (AC-03). */
export const DEFAULT_ANALYTICS_RANGE = { from: '2026-06-01', to: '2026-06-30' } as const;
