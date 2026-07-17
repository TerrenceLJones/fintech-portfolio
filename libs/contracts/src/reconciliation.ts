import type { Money } from './money';

/**
 * How a bank-feed line resolved against the ledger during a reconciliation run. `matched` lines are
 * reconciled automatically and never enter the exceptions queue; the other three are the exception
 * kinds a person works (US-CW-016 AC-01/AC-02/AC-03).
 */
export type MatchStatus = 'matched' | 'suggested' | 'unmatched' | 'ambiguous';

/** How a confirmed reconciliation was arrived at. */
export type MatchMethod = 'exact' | 'fuzzy' | 'manual' | 'split';

/** A transaction as it arrived on the bank feed (e.g. Plaid) — the counterparty name is the bank's spelling. */
export interface BankFeedTransaction {
  id: string;
  /** The counterparty as the bank reported it — e.g. "ABC Corp". */
  payee: string;
  amount: Money;
  /** ISO-8601 date (YYYY-MM-DD) — lexicographically comparable. */
  date: string;
}

/** A ledger entry a bank line can reconcile against — the description is the ledger's spelling of the counterparty. */
export interface LedgerEntry {
  id: string;
  /** The counterparty as the ledger recorded it — e.g. "ABC Corporation". */
  description: string;
  amount: Money;
  /** ISO-8601 date (YYYY-MM-DD). */
  date: string;
}

/**
 * One field's agreement in a fuzzy-match breakdown. The tone lets the client colour the verdict, but
 * the text label carries the meaning on its own — status is never conveyed by colour alone.
 */
export interface MatchFieldVerdict {
  field: 'name' | 'amount' | 'date';
  /** Human label, e.g. "Fuzzy · 84%", "Exact", "Within 1 day". */
  verdict: string;
  tone: 'positive' | 'warning' | 'negative';
}

/**
 * An item in the reconciliation exceptions queue: a bank line the nightly run could not auto-match,
 * carried with its best ledger candidate (when any), status, and — for a fuzzy suggestion — a
 * similarity score and per-field breakdown. Everything here stays actionable rather than hidden
 * (US-CW-016 AC-02): a suggestion can be confirmed or rejected, an unmatched line dismissed or
 * manually matched, an ambiguous one split.
 */
export interface ReconciliationException {
  id: string;
  bankTransaction: BankFeedTransaction;
  /** The best candidate the matcher found; absent for a truly unmatched line. */
  candidate?: LedgerEntry;
  /** Never `matched` — a matched line is reconciled, not an exception. */
  status: Exclude<MatchStatus, 'matched'>;
  /** Overall similarity 0–100, present only for a suggested (fuzzy) match (AC-03). */
  similarityPercent?: number;
  /** The per-field agreement behind the score, for the suggestion card. */
  fieldBreakdown?: MatchFieldVerdict[];
  /**
   * When the run believes an unmatched line actually spans several ledger entries, the entries a split
   * can be assigned across (US-CW-016 AC-05) — the split dialog seeds one portion per candidate.
   */
  splitCandidates?: LedgerEntry[];
  /** Short reason the line is an exception, e.g. "No candidate found", "Possible duplicate". */
  reason: string;
}

/** A confirmed reconciliation — a bank line permanently tied to one or more ledger entries. */
export interface MatchedEntry {
  id: string;
  bankTransaction: BankFeedTransaction;
  /** One entry for a normal match; several for a split match (AC-05). */
  ledgerEntries: LedgerEntry[];
  method: MatchMethod;
  /** ISO-8601 timestamp the match was committed. */
  reconciledAt: string;
}

/** The reconciliation run's headline stats (US-CW-016 AC-01). */
export interface ReconciliationSummary {
  autoMatchedCount: number;
  exceptionsCount: number;
  /** Match rate as a percentage, e.g. 97.3. */
  matchRatePercent: number;
  /** When the nightly job last ran, ISO-8601 timestamp. */
  lastRunAt: string;
  /** The bank-feed source label, e.g. "Plaid bank feed". */
  feedSource: string;
}

/** One portion of a split match — part of a bank line assigned to a ledger entry (US-CW-016 AC-05). */
export interface SplitPortion {
  ledgerEntryId: string;
  /** Display label for the target entry, e.g. "INV-20418". */
  label: string;
  amount: Money;
}

/**
 * The account balance surfaced on the reconciliation view, guarded by an internal-integrity check.
 * When the ledger's postings don't net to the derived balance the value is *withheld* — a Fatal-tier
 * condition — and only a support reference comes back, never a possibly-wrong number (US-CW-016 AC-04).
 */
export type BalanceIntegrityStatus =
  | { status: 'ok'; accountLabel: string; availableBalance: Money }
  | { status: 'integrity_failure'; accountLabel: string; supportReference: string };

/** GET /api/reconciliation/summary */
export interface ReconciliationSummaryResponse {
  summary: ReconciliationSummary;
}

/** GET /api/reconciliation/exceptions */
export interface ReconciliationExceptionsResponse {
  exceptions: ReconciliationException[];
}

/** GET /api/reconciliation/matched */
export interface ReconciliationMatchedResponse {
  matched: MatchedEntry[];
}

/** GET /api/reconciliation/balance */
export interface ReconciliationBalanceResponse {
  balance: BalanceIntegrityStatus;
}

/** POST /api/reconciliation/exceptions/:id/split */
export interface SplitMatchRequest {
  portions: SplitPortion[];
}

/**
 * Body of the 4xx responses reconciliation endpoints can return. `forbidden_role` is the redundant
 * server-side `reconciliation:view` check; `split_mismatch` is the server re-validating that split
 * portions sum exactly to the source amount (AC-05), echoing the expected vs provided totals so the
 * client can explain the shortfall.
 */
export type ReconciliationErrorResponse =
  | { error: 'forbidden_role' }
  | { error: 'exception_not_found' }
  | { error: 'split_mismatch'; expected: Money; provided: Money };
