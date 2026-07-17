import type { BankFeedTransaction, LedgerEntry, Money } from '@clearline/contracts';

/** USD helper — every reconciliation amount is USD minor units (cents). */
function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: 'USD' };
}

/**
 * The seeded bank-feed lines the nightly run reconciles. They're hand-picked so the run produces one
 * of every outcome the exceptions queue must handle (US-CW-016):
 *   - Northwind / Figma / Gusto → clean exact auto-matches (AC-01).
 *   - "ABC Corp" → a fuzzy suggestion against ledger "ABC Corporation" (AC-03).
 *   - "Stripe Payout" → unmatched, no ledger candidate (AC-02).
 *   - "Acme Wholesale" → unmatched, but corresponds to two invoices → a split target (AC-05).
 *   - "WeWork" → two identical ledger candidates → ambiguous / possible duplicate.
 * Dates sit in the demo's June-2026 window and are lexicographically comparable.
 */
export const SEED_BANK_FEED: BankFeedTransaction[] = [
  { id: 'bank_northwind', payee: 'Northwind Traders', amount: usd(500_000), date: '2026-06-28' },
  { id: 'bank_figma', payee: 'Figma', amount: usd(129_200), date: '2026-06-27' },
  { id: 'bank_gusto', payee: 'Gusto', amount: usd(1_862_000), date: '2026-06-28' },
  { id: 'bank_abc', payee: 'ABC Corp', amount: usd(320_000), date: '2026-06-27' },
  { id: 'bank_stripe', payee: 'Stripe Payout', amount: usd(742_100), date: '2026-06-27' },
  { id: 'bank_acme', payee: 'Acme Wholesale', amount: usd(500_000), date: '2026-06-24' },
  { id: 'bank_wework', payee: 'WeWork', amount: usd(424_000), date: '2026-06-26' },
];

/**
 * The seeded ledger entries the bank lines match against. The two INV-204xx rows are the split targets
 * for the Acme line (neither matches its full $5,000 alone); the two WeWork rows are deliberate
 * duplicates that make the WeWork line ambiguous rather than an arbitrary auto-match.
 */
export const SEED_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'led_northwind',
    description: 'Northwind Traders',
    amount: usd(500_000),
    date: '2026-06-28',
  },
  { id: 'led_figma', description: 'Figma', amount: usd(129_200), date: '2026-06-27' },
  { id: 'led_gusto', description: 'Gusto', amount: usd(1_862_000), date: '2026-06-28' },
  { id: 'led_abc', description: 'ABC Corporation', amount: usd(320_000), date: '2026-06-26' },
  {
    id: 'led_inv_20418',
    description: 'INV-20418 · Meridian Supply',
    amount: usd(300_000),
    date: '2026-06-24',
  },
  {
    id: 'led_inv_20419',
    description: 'INV-20419 · Meridian Supply',
    amount: usd(200_000),
    date: '2026-06-24',
  },
  { id: 'led_wework_a', description: 'WeWork', amount: usd(424_000), date: '2026-06-26' },
  { id: 'led_wework_b', description: 'WeWork', amount: usd(424_000), date: '2026-06-26' },
];

/** Bank-line id → ledger entry ids the run offers as split targets when that line is unmatched (AC-05). */
export const SEED_SPLIT_CANDIDATES: Record<string, string[]> = {
  bank_acme: ['led_inv_20418', 'led_inv_20419'],
};

/**
 * The bulk of the nightly job's auto-matches that aren't individually enumerated in the Matched tab —
 * a real feed clears hundreds cleanly ("most of it auto-matches; the work is the exceptions"). The
 * summary's Auto-matched count adds this baseline to the enumerated matches, and the match rate is
 * derived from it against the live exceptions count.
 */
export const SEED_BULK_AUTO_MATCHED = 435;

/** The bank feed source label shown under the reconciliation header. */
export const RECONCILIATION_FEED_SOURCE = 'Plaid bank feed';

/**
 * The account whose balance the reconciliation view surfaces, guarded by the internal-integrity check.
 * The postings net exactly to the derived balance, so the balance renders normally — until the demo
 * arms the discrepancy, which corrupts the derived total so `verifyBalanceIntegrity` fails and the
 * Fatal-tier "we're double-checking your balance" state shows instead (AC-04).
 */
export const SEED_RECONCILIATION_ACCOUNT = {
  label: 'Operating · ••4021',
  /** Postings that net to the derived balance below (2,418,000 − 742,000 + 190,000 = 1,866,000). */
  postings: [usd(2_418_000), usd(-742_000), usd(190_000)],
  derivedBalance: usd(1_866_000),
  /** The stable support reference shown when integrity fails — investigators quote this. */
  supportReference: 'REC-3B81-F009',
} as const;

/** The default seed the ReconciliationService loads — one bundle so tests can clone/override it. */
export const SEED_RECONCILIATION = {
  feedSource: RECONCILIATION_FEED_SOURCE,
  baselineAutoMatched: SEED_BULK_AUTO_MATCHED,
  bankLines: SEED_BANK_FEED,
  ledgerEntries: SEED_LEDGER_ENTRIES,
  splitCandidateIds: SEED_SPLIT_CANDIDATES,
  account: SEED_RECONCILIATION_ACCOUNT,
} as const;
