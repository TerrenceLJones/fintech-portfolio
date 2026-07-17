import { describe, expect, it } from 'vitest';
import { scoreMatch } from './match-scoring';

const ABC_FUZZY = {
  bankPayee: 'ABC Corp',
  bankAmountMinorUnits: 320_000,
  bankDate: '2026-06-27',
  ledgerDescription: 'ABC Corporation',
  ledgerAmountMinorUnits: 320_000,
  ledgerDate: '2026-06-26',
};

describe('scoreMatch', () => {
  it('scores an exact counterparty + amount + same day at 100', () => {
    const score = scoreMatch({
      bankPayee: 'Northwind Traders',
      bankAmountMinorUnits: 500_000,
      bankDate: '2026-06-28',
      ledgerDescription: 'Northwind Traders',
      ledgerAmountMinorUnits: 500_000,
      ledgerDate: '2026-06-28',
    });
    expect(score.similarityPercent).toBe(100);
    expect(score.nameExact).toBe(true);
    expect(score.amountExact).toBe(true);
    expect(score.dayDifference).toBe(0);
  });

  it('surfaces a suffix-variant fuzzy match with an exact amount and near date (AC-03)', () => {
    const score = scoreMatch(ABC_FUZZY);
    expect(score.amountExact).toBe(true);
    expect(score.nameExact).toBe(false);
    expect(score.dayDifference).toBe(1);
    // High enough to suggest, not a perfect score.
    expect(score.similarityPercent).toBeGreaterThan(60);
    expect(score.similarityPercent).toBeLessThan(100);
  });

  it('builds a per-field breakdown: fuzzy name (warning), exact amount + near date (positive)', () => {
    const { fieldBreakdown } = scoreMatch(ABC_FUZZY);
    const name = fieldBreakdown.find((f) => f.field === 'name');
    expect(name?.tone).toBe('warning');
    expect(name?.verdict).toMatch(/^Fuzzy · \d+%$/);
    expect(fieldBreakdown.find((f) => f.field === 'amount')).toEqual({
      field: 'amount',
      verdict: 'Exact',
      tone: 'positive',
    });
    expect(fieldBreakdown.find((f) => f.field === 'date')).toEqual({
      field: 'date',
      verdict: 'Within 1 day',
      tone: 'positive',
    });
  });

  it('marks a differing amount negative in the breakdown', () => {
    const { amountExact, fieldBreakdown } = scoreMatch({
      ...ABC_FUZZY,
      ledgerAmountMinorUnits: 999,
    });
    expect(amountExact).toBe(false);
    expect(fieldBreakdown.find((f) => f.field === 'amount')?.tone).toBe('negative');
  });
});
