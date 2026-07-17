import type {
  BalanceIntegrityStatus,
  BankFeedTransaction,
  LedgerEntry,
  MatchedEntry,
  Money,
  ReconciliationException,
  ReconciliationSummary,
  SplitPortion,
} from '@clearline/contracts';
import {
  reconcileLine,
  validateSplit,
  verifyBalanceIntegrity,
} from '@clearline/domain-reconciliation';
import { SEED_RECONCILIATION } from '../fixtures/reconciliation.fixture';

/** The seed bundle the service reconciles — the app binds the default; tests inject isolated copies. */
export interface ReconciliationSeed {
  feedSource: string;
  baselineAutoMatched: number;
  bankLines: readonly BankFeedTransaction[];
  ledgerEntries: readonly LedgerEntry[];
  splitCandidateIds: Readonly<Record<string, string[]>>;
  account: {
    label: string;
    postings: readonly Money[];
    derivedBalance: Money;
    supportReference: string;
  };
}

/** The result of a split attempt — mirrors the domain validation but with wire Money for the response. */
export type SplitOutcome =
  { ok: true; matched: MatchedEntry } | { ok: false; expected: Money; provided: Money };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory bank-feed reconciliation for US-CW-016. On construction (and on every `runReconciliation`)
 * it replays the seeded bank feed against the ledger through the pure `reconcileLine` classifier,
 * producing the auto-matched set and the exceptions queue. The queue is then a live worklist: a
 * suggestion can be confirmed (→ matched) or rejected (→ unmatched, still queued, AC-03); an unmatched
 * line dismissed or split across ledger entries (AC-05, re-validated server-side that portions sum
 * exactly). The account balance is gated by the pure integrity check — postings must net to the derived
 * balance before any number is shown, else a Fatal-tier support reference is returned instead (AC-04).
 * State is per-instance; the app binds the shared singleton and tests inject a fixed-clock instance.
 */
export class ReconciliationService {
  private readonly seed: ReconciliationSeed;
  private readonly now: () => number;
  private readonly ledgerById: Map<string, LedgerEntry>;

  private matched: MatchedEntry[] = [];
  private exceptions: ReconciliationException[] = [];
  private lastRunAt = 0;
  private balanceFailureArmed = false;

  constructor(
    seed: ReconciliationSeed = SEED_RECONCILIATION,
    now: () => number = () => Date.now(),
  ) {
    this.seed = seed;
    this.now = now;
    this.ledgerById = new Map(seed.ledgerEntries.map((entry) => [entry.id, entry]));
    this.runReconciliation();
  }

  /** Replay the seeded feed through the classifier, rebuilding the matched set and exceptions queue. */
  runReconciliation(): void {
    this.lastRunAt = this.now();
    const reconciledAt = new Date(this.lastRunAt).toISOString();
    const available = [...this.seed.ledgerEntries];
    const matched: MatchedEntry[] = [];
    const exceptions: ReconciliationException[] = [];

    for (const line of this.seed.bankLines) {
      const outcome = reconcileLine(line, available);
      switch (outcome.kind) {
        case 'matched': {
          matched.push({
            id: `match_${line.id}`,
            bankTransaction: line,
            ledgerEntries: [outcome.candidate],
            method: 'exact',
            reconciledAt,
          });
          const index = available.findIndex((entry) => entry.id === outcome.candidate.id);
          if (index !== -1) available.splice(index, 1);
          break;
        }
        case 'suggested':
          exceptions.push({
            id: `exc_${line.id}`,
            bankTransaction: line,
            candidate: outcome.candidate,
            status: 'suggested',
            similarityPercent: outcome.score.similarityPercent,
            fieldBreakdown: outcome.score.fieldBreakdown,
            reason: 'Suggested match',
          });
          break;
        case 'ambiguous':
          exceptions.push({
            id: `exc_${line.id}`,
            bankTransaction: line,
            candidate: outcome.candidates[0],
            status: 'ambiguous',
            reason: 'Possible duplicate',
          });
          break;
        case 'unmatched': {
          const splitCandidates = this.splitCandidatesFor(line.id);
          exceptions.push({
            id: `exc_${line.id}`,
            bankTransaction: line,
            status: 'unmatched',
            ...(splitCandidates.length > 0 ? { splitCandidates } : {}),
            reason: splitCandidates.length > 0 ? 'Matches multiple invoices' : 'No candidate found',
          });
          break;
        }
      }
    }

    this.matched = matched;
    this.exceptions = exceptions;
  }

  private splitCandidatesFor(bankLineId: string): LedgerEntry[] {
    const ids = this.seed.splitCandidateIds[bankLineId] ?? [];
    return ids
      .map((id) => this.ledgerById.get(id))
      .filter((entry): entry is LedgerEntry => !!entry);
  }

  getSummary(): ReconciliationSummary {
    const autoMatchedCount = this.seed.baselineAutoMatched + this.matched.length;
    const exceptionsCount = this.exceptions.length;
    const denominator = autoMatchedCount + exceptionsCount;
    const matchRatePercent =
      denominator === 0 ? 100 : Math.round((autoMatchedCount / denominator) * 1000) / 10;
    return {
      autoMatchedCount,
      exceptionsCount,
      matchRatePercent,
      lastRunAt: new Date(this.lastRunAt).toISOString(),
      feedSource: this.seed.feedSource,
    };
  }

  getExceptions(): ReconciliationException[] {
    return clone(this.exceptions);
  }

  getMatched(): MatchedEntry[] {
    return clone(this.matched);
  }

  /**
   * The reconciliation account's balance, gated by the internal-integrity check. Normally the postings
   * net to the derived balance and the value is returned; when the demo arms the discrepancy the derived
   * total is corrupted so `verifyBalanceIntegrity` fails, and only the Fatal-tier support reference is
   * returned — never the (now untrustworthy) number (AC-04).
   */
  getBalance(): BalanceIntegrityStatus {
    const { account } = this.seed;
    const postings = account.postings.map((p) => p.amountMinorUnits);
    const derived = this.balanceFailureArmed
      ? account.derivedBalance.amountMinorUnits + 1
      : account.derivedBalance.amountMinorUnits;

    if (!verifyBalanceIntegrity(postings, derived)) {
      return {
        status: 'integrity_failure',
        accountLabel: account.label,
        supportReference: account.supportReference,
      };
    }
    return {
      status: 'ok',
      accountLabel: account.label,
      availableBalance: clone(account.derivedBalance),
    };
  }

  /**
   * Confirm an exception's shown ledger candidate → a permanent match, removed from the queue. A
   * suggested (fuzzy) line becomes a `fuzzy` match (AC-03); an ambiguous line, where a person picks the
   * displayed candidate over its duplicate, becomes a `manual` match. Returns null when the line has no
   * candidate to confirm (e.g. a truly unmatched line).
   */
  confirmMatch(exceptionId: string): MatchedEntry | null {
    const exception = this.exceptions.find((e) => e.id === exceptionId);
    if (!exception || !exception.candidate) return null;
    if (exception.status !== 'suggested' && exception.status !== 'ambiguous') return null;
    const matched: MatchedEntry = {
      id: `match_${exception.bankTransaction.id}`,
      bankTransaction: exception.bankTransaction,
      ledgerEntries: [exception.candidate],
      method: exception.status === 'suggested' ? 'fuzzy' : 'manual',
      reconciledAt: new Date(this.now()).toISOString(),
    };
    this.matched.push(matched);
    this.removeException(exceptionId);
    return clone(matched);
  }

  /** Reject a suggestion → it stays in the queue as an unmatched line rather than being discarded (AC-03). */
  rejectSuggestion(exceptionId: string): boolean {
    const exception = this.exceptions.find((e) => e.id === exceptionId);
    if (!exception || exception.status !== 'suggested') return false;
    exception.status = 'unmatched';
    delete exception.candidate;
    delete exception.similarityPercent;
    delete exception.fieldBreakdown;
    exception.reason = 'Suggestion rejected';
    return true;
  }

  /** Dismiss an exception → removed from the queue. */
  dismiss(exceptionId: string): boolean {
    return this.removeException(exceptionId);
  }

  /**
   * Commit a split of an unmatched line across ledger entries. Re-validates server-side (never trusting
   * the client) that the portions sum exactly to the source amount; on mismatch returns the expected vs
   * provided totals so the client can explain the shortfall (AC-05). On success the line becomes a
   * `split`-method match tied to every portion's ledger entry.
   */
  splitMatch(exceptionId: string, portions: SplitPortion[]): SplitOutcome | null {
    const exception = this.exceptions.find((e) => e.id === exceptionId);
    if (!exception) return null;

    const currency = exception.bankTransaction.amount.currency;
    const validation = validateSplit(
      exception.bankTransaction.amount.amountMinorUnits,
      portions.map((p) => p.amount.amountMinorUnits),
    );
    if (!validation.ok) {
      return {
        ok: false,
        expected: { amountMinorUnits: validation.expectedMinorUnits, currency },
        provided: { amountMinorUnits: validation.providedMinorUnits, currency },
      };
    }

    const ledgerEntries: LedgerEntry[] = portions.map((portion) => {
      const seeded = this.ledgerById.get(portion.ledgerEntryId);
      return (
        seeded ?? {
          id: portion.ledgerEntryId,
          description: portion.label,
          amount: portion.amount,
          date: exception.bankTransaction.date,
        }
      );
    });

    const matched: MatchedEntry = {
      id: `match_${exception.bankTransaction.id}`,
      bankTransaction: exception.bankTransaction,
      ledgerEntries,
      method: 'split',
      reconciledAt: new Date(this.now()).toISOString(),
    };
    this.matched.push(matched);
    this.removeException(exceptionId);
    return { ok: true, matched: clone(matched) };
  }

  /** Arm/disarm the balance-integrity discrepancy for the Fatal-tier demo (AC-04). */
  setBalanceIntegrityFailure(armed: boolean): void {
    this.balanceFailureArmed = armed;
  }

  isBalanceIntegrityFailureArmed(): boolean {
    return this.balanceFailureArmed;
  }

  private removeException(exceptionId: string): boolean {
    const index = this.exceptions.findIndex((e) => e.id === exceptionId);
    if (index === -1) return false;
    this.exceptions.splice(index, 1);
    return true;
  }
}
