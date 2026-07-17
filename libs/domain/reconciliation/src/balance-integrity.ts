/**
 * Verify an account's internal ledger integrity: the sum of its postings must equal the independently
 * derived balance, exactly (integer minor units, no tolerance). When this holds the balance is safe to
 * display; when it does not, the balance is a Fatal-tier condition — the value is withheld and the
 * discrepancy investigated rather than a possibly-wrong number being shown (US-CW-016 AC-04). Pure so
 * both the mock backend (before it will render a balance) and any client-side guard share one rule.
 */
export function verifyBalanceIntegrity(
  postingsMinorUnits: readonly number[],
  derivedBalanceMinorUnits: number,
): boolean {
  const postingsTotal = postingsMinorUnits.reduce((total, amount) => total + amount, 0);
  return postingsTotal === derivedBalanceMinorUnits;
}
