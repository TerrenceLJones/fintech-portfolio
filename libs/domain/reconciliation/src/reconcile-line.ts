import type { BankFeedTransaction, LedgerEntry } from '@clearline/contracts';
import { DATE_PROXIMITY_DAYS, FUZZY_SUGGEST_THRESHOLD_PERCENT } from './constants';
import { scoreMatch, type MatchScore } from './match-scoring';

/**
 * The outcome of reconciling one bank line against the ledger candidates still available to it:
 *  - `matched`    — exactly one candidate agrees on counterparty, amount and date → auto-reconcile (AC-01).
 *  - `ambiguous`  — two or more candidates match exactly, so the run can't tell which → review (duplicate edge case).
 *  - `suggested`  — the best candidate clears the fuzzy threshold but isn't exact → confirm/reject (AC-03).
 *  - `unmatched`  — nothing came close → the exceptions queue as an unmatched line (AC-02).
 */
export type LineReconciliation =
  | { kind: 'matched'; candidate: LedgerEntry }
  | { kind: 'ambiguous'; candidates: LedgerEntry[] }
  | { kind: 'suggested'; candidate: LedgerEntry; score: MatchScore }
  | { kind: 'unmatched' };

function scoreFor(bank: BankFeedTransaction, ledger: LedgerEntry): MatchScore {
  return scoreMatch({
    bankPayee: bank.payee,
    bankAmountMinorUnits: bank.amount.amountMinorUnits,
    bankDate: bank.date,
    ledgerDescription: ledger.description,
    ledgerAmountMinorUnits: ledger.amount.amountMinorUnits,
    ledgerDate: ledger.date,
  });
}

/** An exact auto-match: same counterparty, same amount, dates inside the proximity window. */
function isExact(score: MatchScore): boolean {
  return score.nameExact && score.amountExact && score.dayDifference <= DATE_PROXIMITY_DAYS;
}

/**
 * Classify one bank line against the ledger entries still available to match. Exact matches win first;
 * two or more exact matches are ambiguous (the same-amount/same-day duplicate risk) rather than an
 * arbitrary auto-match; otherwise the highest-scoring candidate is a fuzzy suggestion when it clears
 * FUZZY_SUGGEST_THRESHOLD_PERCENT, and everything else is unmatched. Pure — the caller owns which
 * candidates remain (an entry consumed by a match is removed before the next line is reconciled).
 */
export function reconcileLine(
  bank: BankFeedTransaction,
  candidates: readonly LedgerEntry[],
): LineReconciliation {
  const scored = candidates.map((candidate) => ({ candidate, score: scoreFor(bank, candidate) }));

  const exact = scored.filter((entry) => isExact(entry.score));
  if (exact.length === 1) return { kind: 'matched', candidate: exact[0]!.candidate };
  if (exact.length > 1) {
    return { kind: 'ambiguous', candidates: exact.map((entry) => entry.candidate) };
  }

  const best = scored.reduce<(typeof scored)[number] | null>((top, entry) => {
    return top === null || entry.score.similarityPercent > top.score.similarityPercent
      ? entry
      : top;
  }, null);

  if (best && best.score.similarityPercent >= FUZZY_SUGGEST_THRESHOLD_PERCENT) {
    return { kind: 'suggested', candidate: best.candidate, score: best.score };
  }

  return { kind: 'unmatched' };
}
