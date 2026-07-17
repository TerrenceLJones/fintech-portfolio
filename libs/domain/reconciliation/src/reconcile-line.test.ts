import { describe, expect, it } from 'vitest';
import type { BankFeedTransaction, LedgerEntry } from '@clearline/contracts';
import { reconcileLine } from './reconcile-line';

const usd = (amountMinorUnits: number) => ({ amountMinorUnits, currency: 'USD' });

const bank = (over: Partial<BankFeedTransaction> = {}): BankFeedTransaction => ({
  id: 'bank_1',
  payee: 'Northwind Traders',
  amount: usd(500_000),
  date: '2026-06-28',
  ...over,
});

const ledger = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 'led_1',
  description: 'Northwind Traders',
  amount: usd(500_000),
  date: '2026-06-28',
  ...over,
});

describe('reconcileLine', () => {
  it('auto-matches a single exact candidate (AC-01)', () => {
    const result = reconcileLine(bank(), [ledger()]);
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.candidate.id).toBe('led_1');
  });

  it('marks two exact candidates ambiguous rather than guessing (duplicate risk)', () => {
    const result = reconcileLine(bank(), [ledger(), ledger({ id: 'led_2' })]);
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') expect(result.candidates).toHaveLength(2);
  });

  it('suggests a fuzzy candidate that clears the threshold but is not exact (AC-03)', () => {
    const result = reconcileLine(
      bank({ payee: 'ABC Corp', amount: usd(320_000), date: '2026-06-27' }),
      [
        ledger({
          id: 'led_abc',
          description: 'ABC Corporation',
          amount: usd(320_000),
          date: '2026-06-26',
        }),
      ],
    );
    expect(result.kind).toBe('suggested');
    if (result.kind === 'suggested') {
      expect(result.candidate.id).toBe('led_abc');
      expect(result.score.similarityPercent).toBeGreaterThanOrEqual(60);
    }
  });

  it('leaves a line with no plausible candidate unmatched (AC-02)', () => {
    const result = reconcileLine(bank({ payee: 'Stripe Payout', amount: usd(742_100) }), [
      ledger({ description: 'Gusto', amount: usd(1_800_000), date: '2026-06-05' }),
    ]);
    expect(result.kind).toBe('unmatched');
  });

  it('is unmatched when there are no candidates at all', () => {
    expect(reconcileLine(bank(), []).kind).toBe('unmatched');
  });
});
