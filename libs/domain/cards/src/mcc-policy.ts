/**
 * True when a transaction's merchant category is permitted on the card. An empty allow-list means the
 * card is unrestricted, so any category passes; otherwise the transaction's MCC must be listed
 * (US-CW-014 AC-03). Matching is on the stable MCC `code`, not the display label.
 */
export function isMccAllowed(allowedMccs: readonly string[], transactionMcc: string): boolean {
  return allowedMccs.length === 0 || allowedMccs.includes(transactionMcc);
}
