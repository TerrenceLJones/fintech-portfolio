/**
 * Normalise a counterparty name for comparison: lower-cased, punctuation stripped, and whitespace
 * collapsed. Deliberately does NOT drop company suffixes (Corp/Inc/LLC) — the fuzzy matcher wants
 * "ABC Corp" and "ABC Corporation" to score *close but not identical*, so the user still confirms the
 * suggestion (US-CW-016 AC-03) rather than it silently auto-matching.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two names are the same counterparty after normalisation — the bar an exact auto-match clears. */
export function isExactNameMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

/** The set of adjacent character bigrams of a string (spaces removed), for the Dice coefficient below. */
function bigrams(value: string): string[] {
  const compact = value.replace(/\s/g, '');
  const pairs: string[] = [];
  for (let i = 0; i < compact.length - 1; i += 1) {
    pairs.push(compact.slice(i, i + 2));
  }
  return pairs;
}

/**
 * Sørensen–Dice similarity of two counterparty names over their character bigrams, from 0 (nothing in
 * common) to 1 (identical after normalisation). Chosen over raw edit distance because it rewards a
 * shared token core ("ABC Corp" vs "ABC Corporation") while still penalising the extra characters, so
 * a genuine near-match scores high without a longer-suffix variant collapsing to a low ratio. The score
 * is symmetric and, combined with amount + date in match-scoring, drives the fuzzy-suggestion threshold.
 */
export function nameSimilarity(a: string, b: string): number {
  const normalizedA = normalizeName(a);
  const normalizedB = normalizeName(b);
  if (normalizedA === normalizedB) return 1;

  const bigramsA = bigrams(normalizedA);
  const bigramsB = bigrams(normalizedB);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  // Multiset intersection: consume each matched bigram from B so repeats aren't double-counted.
  const remaining = [...bigramsB];
  let shared = 0;
  for (const pair of bigramsA) {
    const index = remaining.indexOf(pair);
    if (index !== -1) {
      shared += 1;
      remaining.splice(index, 1);
    }
  }

  return (2 * shared) / (bigramsA.length + bigramsB.length);
}
