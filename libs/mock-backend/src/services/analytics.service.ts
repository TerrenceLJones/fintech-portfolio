import type {
  CategorySpend,
  DateRange,
  DepartmentSpend,
  Money,
  SpendSummary,
  SpendTransaction,
  VendorSpend,
} from '@clearline/contracts';
import {
  DEFAULT_ANALYTICS_RANGE,
  SEED_ANALYTICS_KPIS,
  SEED_SPEND_TRANSACTIONS,
  type SeedTransaction,
} from '../fixtures/analytics.fixture';

const CURRENCY = 'USD';

function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: CURRENCY };
}

/**
 * In-memory spend analytics for the dashboard. Every breakdown and the summary total are derived on
 * each read from one seeded transaction list, so a date range that matches no transactions yields an
 * empty dashboard (the client's AC-03 empty state) with no separate emptiness bookkeeping. The
 * summary also carries a `lastRefreshedAt` stamp the service owns: it advances on `refresh()` (the
 * dashboard's manual Refresh, AC-06) and can be backdated for the stale-data demo. State is
 * per-instance; the app binds the shared singleton and tests inject isolated instances with a fixed
 * clock so the freshness stamp is deterministic.
 */
export class AnalyticsService {
  private readonly transactions: SeedTransaction[];
  private readonly now: () => number;
  private lastRefreshedAt: number;

  constructor(
    seed: SeedTransaction[] = SEED_SPEND_TRANSACTIONS,
    now: () => number = () => Date.now(),
  ) {
    this.transactions = seed;
    this.now = now;
    this.lastRefreshedAt = now();
  }

  /** Advance the freshness stamp to "now" — the effect of the dashboard's manual Refresh (AC-06). */
  refresh(): void {
    this.lastRefreshedAt = this.now();
  }

  /** Backdate the freshness stamp by `minutes` so the stale-data indicator shows (demo/e2e for AC-06). */
  backdateRefresh(minutes: number): void {
    this.lastRefreshedAt = this.now() - minutes * 60_000;
  }

  private inRange(range: DateRange): SeedTransaction[] {
    // ISO YYYY-MM-DD sorts lexicographically, so an inclusive range is a plain string comparison.
    return this.transactions.filter((t) => t.date >= range.from && t.date <= range.to);
  }

  private static sum(items: { amount: Money }[]): number {
    return items.reduce((total, item) => total + item.amount.amountMinorUnits, 0);
  }

  getSummary(range: DateRange): SpendSummary {
    const matched = this.inRange(range);
    return {
      totalSpend: usd(AnalyticsService.sum(matched)),
      pendingApprovalsCount: SEED_ANALYTICS_KPIS.pendingApprovalsCount,
      pendingApprovalsAmount: SEED_ANALYTICS_KPIS.pendingApprovalsAmount,
      budgetRemaining: SEED_ANALYTICS_KPIS.budgetRemaining,
      budgetTotal: SEED_ANALYTICS_KPIS.budgetTotal,
      activeCards: SEED_ANALYTICS_KPIS.activeCards,
      frozenCards: SEED_ANALYTICS_KPIS.frozenCards,
      transactionCount: matched.length,
      lastRefreshedAt: new Date(this.lastRefreshedAt).toISOString(),
    };
  }

  getSpendByCategory(range: DateRange): CategorySpend[] {
    const totals = this.groupSums(this.inRange(range), (t) => t.category);
    const max = Math.max(0, ...totals.map(([, amount]) => amount));
    return totals
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount: usd(amount),
        // Pre-computed bar fill so the client stays presentational; guard the empty-range divide-by-zero.
        fractionOfMax: max === 0 ? 0 : amount / max,
      }));
  }

  getByDepartment(range: DateRange): DepartmentSpend[] {
    return this.groupSums(this.inRange(range), (t) => t.department)
      .sort((a, b) => b[1] - a[1])
      .map(([department, amount]) => ({ department, amount: usd(amount) }));
  }

  getTopVendors(range: DateRange, limit = 5): VendorSpend[] {
    return this.groupSums(this.inRange(range), (t) => t.vendor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([vendor, amount]) => ({ vendor, amount: usd(amount) }));
  }

  getRecentActivity(range: DateRange, limit = 6): SpendTransaction[] {
    return (
      this.inRange(range)
        .slice()
        // Most recent first; break same-date ties by larger amount so the biggest movement leads.
        .sort((a, b) =>
          a.date === b.date
            ? b.amount.amountMinorUnits - a.amount.amountMinorUnits
            : b.date.localeCompare(a.date),
        )
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          vendor: t.vendor,
          category: t.category,
          date: t.date,
          amount: t.amount,
          ...(t.anomaly ? { anomaly: t.anomaly } : {}),
        }))
    );
  }

  private groupSums(
    items: SeedTransaction[],
    keyOf: (t: SeedTransaction) => string,
  ): [string, number][] {
    const sums = new Map<string, number>();
    for (const item of items) {
      const key = keyOf(item);
      sums.set(key, (sums.get(key) ?? 0) + item.amount.amountMinorUnits);
    }
    return [...sums.entries()];
  }
}

export { DEFAULT_ANALYTICS_RANGE };
