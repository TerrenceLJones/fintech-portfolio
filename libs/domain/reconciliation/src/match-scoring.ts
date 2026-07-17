import type { MatchFieldVerdict } from '@clearline/contracts';
import { DATE_PROXIMITY_DAYS, MATCH_WEIGHTS } from './constants';
import { daysBetween } from './date-proximity';
import { isExactNameMatch, nameSimilarity } from './name-similarity';

/** The fields scoreMatch compares — kept structural so the domain never depends on the wire envelope. */
export interface ScoreInput {
  bankPayee: string;
  bankAmountMinorUnits: number;
  bankDate: string;
  ledgerDescription: string;
  ledgerAmountMinorUnits: number;
  ledgerDate: string;
}

export interface MatchScore {
  /** Overall similarity 0–100 (rounded), blending name, amount and date per MATCH_WEIGHTS. */
  similarityPercent: number;
  /** Name Dice similarity as a 0–100 percent. */
  nameSimilarityPercent: number;
  /** True when the amounts are equal to the cent. */
  amountExact: boolean;
  /** True when the names normalise to the same counterparty (the exact-match bar). */
  nameExact: boolean;
  /** Whole calendar days between the two dates. */
  dayDifference: number;
  /** The per-field agreement, ready to surface on a suggestion card (positive/warning verdicts). */
  fieldBreakdown: MatchFieldVerdict[];
}

/** A day-proximity sub-score in [0,1]: 1 for the same day, tapering to 0 once beyond the window. */
function dateScore(dayDifference: number): number {
  if (dayDifference >= Infinity) return 0;
  if (dayDifference > DATE_PROXIMITY_DAYS) return 0;
  return 1 - dayDifference / (DATE_PROXIMITY_DAYS + 1);
}

function dateVerdict(dayDifference: number): MatchFieldVerdict {
  if (dayDifference === 0) return { field: 'date', verdict: 'Same day', tone: 'positive' };
  if (dayDifference <= DATE_PROXIMITY_DAYS) {
    const unit = dayDifference === 1 ? 'day' : 'days';
    return { field: 'date', verdict: `Within ${dayDifference} ${unit}`, tone: 'positive' };
  }
  return { field: 'date', verdict: `${dayDifference} days apart`, tone: 'warning' };
}

/**
 * Score a bank line against a single ledger candidate across name, amount and date. The overall
 * percentage blends a name Dice similarity, an exact-amount signal, and date proximity by MATCH_WEIGHTS
 * — the number the exceptions queue shows as "NN% match" and the fuzzy card breaks down field by field
 * (US-CW-016 AC-03). Pure and deterministic: the same pair always scores the same.
 */
export function scoreMatch(input: ScoreInput): MatchScore {
  const nameRatio = nameSimilarity(input.bankPayee, input.ledgerDescription);
  const nameExact = isExactNameMatch(input.bankPayee, input.ledgerDescription);
  const amountExact = input.bankAmountMinorUnits === input.ledgerAmountMinorUnits;
  const dayDifference = daysBetween(input.bankDate, input.ledgerDate);

  const overall =
    MATCH_WEIGHTS.name * nameRatio +
    MATCH_WEIGHTS.amount * (amountExact ? 1 : 0) +
    MATCH_WEIGHTS.date * dateScore(dayDifference);

  const nameSimilarityPercent = Math.round(nameRatio * 100);

  const fieldBreakdown: MatchFieldVerdict[] = [
    nameExact
      ? { field: 'name', verdict: 'Exact', tone: 'positive' }
      : { field: 'name', verdict: `Fuzzy · ${nameSimilarityPercent}%`, tone: 'warning' },
    amountExact
      ? { field: 'amount', verdict: 'Exact', tone: 'positive' }
      : { field: 'amount', verdict: 'Differs', tone: 'negative' },
    dateVerdict(dayDifference),
  ];

  return {
    similarityPercent: Math.round(overall * 100),
    nameSimilarityPercent,
    amountExact,
    nameExact,
    dayDifference,
    fieldBreakdown,
  };
}
