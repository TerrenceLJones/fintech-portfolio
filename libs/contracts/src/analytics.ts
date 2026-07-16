import type { Money } from './money';

/**
 * A closed date range for the spend dashboard, as inclusive ISO-8601 calendar dates (YYYY-MM-DD).
 * The client validates start/end ordering before it ever becomes a query — an invalid range is
 * never sent to the server (US-CW-015 AC-04).
 */
export interface DateRange {
  /** Inclusive start date, ISO-8601 (YYYY-MM-DD). */
  from: string;
  /** Inclusive end date, ISO-8601 (YYYY-MM-DD). */
  to: string;
}

/**
 * The dashboard's top-line KPIs plus the freshness stamp every section is measured against. Monetary
 * fields are minor-units Money so the client renders them through the same skeleton-first MoneyDisplay
 * as everywhere else — never a bare "$0.00" while loading (US-CW-015 AC-01).
 */
export interface SpendSummary {
  /** Total spend across all departments for the selected range. */
  totalSpend: Money;
  /** Count of expenses awaiting the viewer's decision, and their combined amount. */
  pendingApprovalsCount: number;
  pendingApprovalsAmount: Money;
  /** Remaining budget — a ledger projection (monthly budget minus committed spend), never an editable input. */
  budgetRemaining: Money;
  budgetTotal: Money;
  /** Active (non-frozen) virtual cards, and how many of the total are frozen. */
  activeCards: number;
  frozenCards: number;
  /**
   * Number of transactions matched by the selected range. Zero means "no transactions in this date
   * range" — an empty state, never an error (US-CW-015 AC-03).
   */
  transactionCount: number;
  /** When the underlying data was last refreshed, ISO-8601 timestamp — drives the freshness indicator (AC-06). */
  lastRefreshedAt: string;
}

/** One category's share of spend, with a 0–1 fraction of the largest category for the bar width. */
export interface CategorySpend {
  category: string;
  amount: Money;
  /** Share of the top category's amount, 0–1 — the pre-computed bar fill so the client stays presentational. */
  fractionOfMax: number;
}

/** One department's total spend for the range. */
export interface DepartmentSpend {
  department: string;
  amount: Money;
}

/** One vendor's total spend for the range, highest first. */
export interface VendorSpend {
  vendor: string;
  amount: Money;
}

/**
 * An anomaly-detection verdict attached to a transaction. Carries both the confidence and the
 * baseline it deviated from so the client can render an icon + "Unusual amount" label + confidence —
 * never colour alone (US-CW-015 AC-02).
 */
export interface AnomalyFlag {
  /** The model's confidence the amount is unusual, as a whole percent (e.g. 87 → "AI 87% confidence"). */
  confidencePercent: number;
  /** The normal/expected amount this transaction deviated from, for "normally ~$11,000". */
  normalAmount?: Money;
}

/** A recent transaction on the dashboard's activity feed; `anomaly` is present only when flagged. */
export interface SpendTransaction {
  id: string;
  vendor: string;
  category: string;
  /** ISO-8601 date (YYYY-MM-DD). */
  date: string;
  amount: Money;
  anomaly?: AnomalyFlag;
}

/** GET /api/analytics/summary */
export interface SpendSummaryResponse {
  summary: SpendSummary;
}

/** GET /api/analytics/spend-by-category */
export interface SpendByCategoryResponse {
  categories: CategorySpend[];
}

/** GET /api/analytics/by-department */
export interface ByDepartmentResponse {
  departments: DepartmentSpend[];
}

/** GET /api/analytics/top-vendors */
export interface TopVendorsResponse {
  vendors: VendorSpend[];
}

/** GET /api/analytics/recent-activity */
export interface RecentActivityResponse {
  transactions: SpendTransaction[];
}

/** Body of a 403 from any analytics endpoint — the redundant server-side check behind US-CW-015's route guard. */
export interface AnalyticsErrorResponse {
  error: 'forbidden_role';
}
