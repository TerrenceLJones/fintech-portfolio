import { describe, expect, it } from 'vitest';
import { ReconciliationService } from './reconciliation.service';

const FIXED_NOW = Date.parse('2026-06-29T09:00:00.000Z');
const make = () => new ReconciliationService(undefined, () => FIXED_NOW);

/** Find a seeded exception by its bank-line id suffix. */
function exception(service: ReconciliationService, bankLineId: string) {
  return service.getExceptions().find((e) => e.id === `exc_${bankLineId}`);
}

describe('ReconciliationService — run classification', () => {
  it('auto-matches an exact bank line and keeps it out of the exceptions queue (AC-01)', () => {
    const service = make();
    const matched = service.getMatched();
    expect(
      matched.some((m) => m.bankTransaction.id === 'bank_northwind' && m.method === 'exact'),
    ).toBe(true);
    expect(exception(service, 'bank_northwind')).toBeUndefined();
  });

  it('surfaces a bank line with no ledger candidate as unmatched (AC-02)', () => {
    const stripe = exception(make(), 'bank_stripe');
    expect(stripe?.status).toBe('unmatched');
    expect(stripe?.candidate).toBeUndefined();
    expect(stripe?.reason).toBe('No candidate found');
  });

  it('surfaces a suffix variant as a suggested fuzzy match with a score and breakdown (AC-03)', () => {
    const abc = exception(make(), 'bank_abc');
    expect(abc?.status).toBe('suggested');
    expect(abc?.candidate?.id).toBe('led_abc');
    expect(abc?.similarityPercent).toBeGreaterThanOrEqual(60);
    expect(abc?.fieldBreakdown).toHaveLength(3);
  });

  it('marks a line with two identical candidates ambiguous (possible duplicate)', () => {
    const wework = exception(make(), 'bank_wework');
    expect(wework?.status).toBe('ambiguous');
    expect(wework?.reason).toBe('Possible duplicate');
  });

  it('offers split candidates on an unmatched line that spans two invoices (AC-05)', () => {
    const acme = exception(make(), 'bank_acme');
    expect(acme?.status).toBe('unmatched');
    expect(acme?.splitCandidates?.map((c) => c.id)).toEqual(['led_inv_20418', 'led_inv_20419']);
  });

  it('derives the summary: auto-matched includes the bulk baseline, rate from live exceptions', () => {
    const service = make();
    const summary = service.getSummary();
    // 435 baseline + 3 enumerated exact matches (Northwind, Figma, Gusto).
    expect(summary.autoMatchedCount).toBe(438);
    expect(summary.exceptionsCount).toBe(service.getExceptions().length);
    expect(summary.matchRatePercent).toBeGreaterThan(90);
    expect(summary.feedSource).toBe('Plaid bank feed');
  });
});

describe('ReconciliationService — queue actions', () => {
  it('confirms a suggestion into a permanent fuzzy match, removing it from the queue (AC-03)', () => {
    const service = make();
    const matched = service.confirmMatch('exc_bank_abc');
    expect(matched?.method).toBe('fuzzy');
    expect(exception(service, 'bank_abc')).toBeUndefined();
    expect(service.getMatched().some((m) => m.bankTransaction.id === 'bank_abc')).toBe(true);
  });

  it('confirms an ambiguous line onto its shown candidate as a manual match', () => {
    const service = make();
    const matched = service.confirmMatch('exc_bank_wework');
    expect(matched?.method).toBe('manual');
    expect(exception(service, 'bank_wework')).toBeUndefined();
  });

  it('will not confirm a truly unmatched line that has no candidate', () => {
    const service = make();
    expect(service.confirmMatch('exc_bank_stripe')).toBeNull();
    expect(exception(service, 'bank_stripe')).toBeDefined();
  });

  it('keeps a rejected suggestion in the queue as unmatched rather than discarding it (AC-03)', () => {
    const service = make();
    expect(service.rejectSuggestion('exc_bank_abc')).toBe(true);
    const abc = exception(service, 'bank_abc');
    expect(abc?.status).toBe('unmatched');
    expect(abc?.candidate).toBeUndefined();
  });

  it('dismisses an exception out of the queue', () => {
    const service = make();
    expect(service.dismiss('exc_bank_stripe')).toBe(true);
    expect(exception(service, 'bank_stripe')).toBeUndefined();
  });

  it('rejects a split whose portions do not sum to the amount, echoing expected vs provided (AC-05)', () => {
    const service = make();
    const outcome = service.splitMatch('exc_bank_acme', [
      {
        ledgerEntryId: 'led_inv_20418',
        label: 'INV-20418',
        amount: { amountMinorUnits: 300_000, currency: 'USD' },
      },
      {
        ledgerEntryId: 'led_inv_20419',
        label: 'INV-20419',
        amount: { amountMinorUnits: 150_000, currency: 'USD' },
      },
    ]);
    expect(outcome).toEqual({
      ok: false,
      expected: { amountMinorUnits: 500_000, currency: 'USD' },
      provided: { amountMinorUnits: 450_000, currency: 'USD' },
    });
    // Still queued — a failed split doesn't consume the exception.
    expect(exception(service, 'bank_acme')).toBeDefined();
  });

  it('commits a balanced split as a split-method match across both invoices (AC-05)', () => {
    const service = make();
    const outcome = service.splitMatch('exc_bank_acme', [
      {
        ledgerEntryId: 'led_inv_20418',
        label: 'INV-20418',
        amount: { amountMinorUnits: 300_000, currency: 'USD' },
      },
      {
        ledgerEntryId: 'led_inv_20419',
        label: 'INV-20419',
        amount: { amountMinorUnits: 200_000, currency: 'USD' },
      },
    ]);
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) expect(outcome.matched.ledgerEntries).toHaveLength(2);
    expect(exception(service, 'bank_acme')).toBeUndefined();
  });
});

describe('ReconciliationService — balance integrity (AC-04)', () => {
  it('returns the balance when postings net to the derived total', () => {
    const balance = make().getBalance();
    expect(balance.status).toBe('ok');
    if (balance.status === 'ok') expect(balance.availableBalance.amountMinorUnits).toBe(1_866_000);
  });

  it('withholds the balance and returns a support reference when armed (Fatal-tier)', () => {
    const service = make();
    service.setBalanceIntegrityFailure(true);
    const balance = service.getBalance();
    expect(balance.status).toBe('integrity_failure');
    if (balance.status === 'integrity_failure') {
      expect(balance.supportReference).toBe('REC-3B81-F009');
      expect(balance).not.toHaveProperty('availableBalance');
    }
  });
});
