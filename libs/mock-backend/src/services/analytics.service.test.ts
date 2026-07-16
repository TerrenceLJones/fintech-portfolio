import { describe, expect, it } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { DEFAULT_ANALYTICS_RANGE, type SeedTransaction } from '../fixtures/analytics.fixture';

const JUNE = DEFAULT_ANALYTICS_RANGE;
const EMPTY_RANGE = { from: '2026-07-01', to: '2026-07-07' };

const FIXED_NOW = Date.UTC(2026, 6, 16, 12, 0, 0); // 2026-07-16T12:00:00Z
const clock = () => FIXED_NOW;

const SEED: SeedTransaction[] = [
  {
    id: 't1',
    vendor: 'Gusto',
    category: 'Payroll',
    department: 'Operations',
    date: '2026-06-28',
    amount: { amountMinorUnits: 200_000, currency: 'USD' },
  },
  {
    id: 't2',
    vendor: 'AWS',
    category: 'Software',
    department: 'Engineering',
    date: '2026-06-27',
    amount: { amountMinorUnits: 50_000, currency: 'USD' },
  },
  {
    id: 't3',
    vendor: 'WeWork',
    category: 'Office',
    department: 'Operations',
    date: '2026-06-26',
    amount: { amountMinorUnits: 80_000, currency: 'USD' },
    anomaly: { confidencePercent: 87, normalAmount: { amountMinorUnits: 20_000, currency: 'USD' } },
  },
];

describe('AnalyticsService', () => {
  it('sums total spend and counts transactions within the range', () => {
    const service = new AnalyticsService(SEED, clock);
    const summary = service.getSummary(JUNE);
    expect(summary.totalSpend.amountMinorUnits).toBe(330_000);
    expect(summary.transactionCount).toBe(3);
  });

  it('returns an empty, zero-total summary for a range with no matching transactions (AC-03)', () => {
    const service = new AnalyticsService(SEED, clock);
    const summary = service.getSummary(EMPTY_RANGE);
    expect(summary.transactionCount).toBe(0);
    expect(summary.totalSpend.amountMinorUnits).toBe(0);
  });

  it('groups spend by category, largest first, with fractionOfMax normalised to the top category', () => {
    const service = new AnalyticsService(SEED, clock);
    const categories = service.getSpendByCategory(JUNE);
    expect(categories[0]).toMatchObject({ category: 'Payroll', fractionOfMax: 1 });
    expect(categories.find((c) => c.category === 'Office')?.fractionOfMax).toBeCloseTo(0.4);
  });

  it('groups spend by department, largest first', () => {
    const service = new AnalyticsService(SEED, clock);
    const departments = service.getByDepartment(JUNE);
    expect(departments[0]).toMatchObject({ department: 'Operations' });
    expect(departments[0]?.amount.amountMinorUnits).toBe(280_000);
  });

  it('ranks top vendors by spend', () => {
    const service = new AnalyticsService(SEED, clock);
    const vendors = service.getTopVendors(JUNE);
    expect(vendors.map((v) => v.vendor)).toEqual(['Gusto', 'WeWork', 'AWS']);
  });

  it('returns recent activity most-recent-first, carrying the anomaly flag (AC-02)', () => {
    const service = new AnalyticsService(SEED, clock);
    const activity = service.getRecentActivity(JUNE);
    expect(activity[0]?.id).toBe('t1');
    const wework = activity.find((t) => t.vendor === 'WeWork');
    expect(wework?.anomaly).toEqual({
      confidencePercent: 87,
      normalAmount: { amountMinorUnits: 20_000, currency: 'USD' },
    });
    // Non-anomalous rows carry no flag at all — never a colour-only signal.
    expect(activity.find((t) => t.vendor === 'Gusto')?.anomaly).toBeUndefined();
  });

  it('stamps lastRefreshedAt from the clock and advances it on refresh (AC-06)', () => {
    let tick = FIXED_NOW;
    const service = new AnalyticsService(SEED, () => tick);
    expect(service.getSummary(JUNE).lastRefreshedAt).toBe(new Date(FIXED_NOW).toISOString());
    tick = FIXED_NOW + 5 * 60_000;
    service.refresh();
    expect(service.getSummary(JUNE).lastRefreshedAt).toBe(new Date(tick).toISOString());
  });

  it('backdates the freshness stamp for the stale-data indicator (AC-06)', () => {
    const service = new AnalyticsService(SEED, clock);
    service.backdateRefresh(10);
    expect(service.getSummary(JUNE).lastRefreshedAt).toBe(
      new Date(FIXED_NOW - 10 * 60_000).toISOString(),
    );
  });

  it('defaults its seed to the June demo fixtures', () => {
    const service = new AnalyticsService(undefined, clock);
    expect(service.getSummary(JUNE).transactionCount).toBeGreaterThan(0);
  });
});
