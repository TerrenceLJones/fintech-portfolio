/**
 * Reconciliation matching thresholds — the tuned constants the nightly run applies. Kept in one place
 * so the classifier (reconcile-line) and any surface that explains a score agree on the same numbers.
 */

/**
 * Overall similarity (0–100) at or above which a bank line + ledger candidate that is NOT an exact
 * match is surfaced as a *suggested* fuzzy match for the user to confirm or reject (US-CW-016 AC-03),
 * rather than dropped as unmatched. Below it, the line is treated as unmatched.
 */
export const FUZZY_SUGGEST_THRESHOLD_PERCENT = 60;

/**
 * The maximum number of calendar days between a bank line and a ledger entry for their dates to still
 * count as "the same payment". Exact matches must fall inside this window; fuzzy suggestions score the
 * gap ("Within N days") but a wider gap drives the date sub-score toward zero.
 */
export const DATE_PROXIMITY_DAYS = 3;

/**
 * The weights the overall similarity score blends its three signals with — name carries the most, then
 * an exact amount, then date proximity. They sum to 1 so the result stays a clean 0–100 percentage.
 */
export const MATCH_WEIGHTS = {
  name: 0.5,
  amount: 0.35,
  date: 0.15,
} as const;
