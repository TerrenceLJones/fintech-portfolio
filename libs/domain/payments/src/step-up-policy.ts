/**
 * The step-up (3DS-style) risk threshold: payments strictly above this require strong authentication
 * before they can commit (US-CW-010 AC-01). $10,000.00, expressed in USD minor units (cents). The mock
 * backend enforces the same value server-side; the client uses it only to anticipate the challenge.
 */
export const STEP_UP_THRESHOLD_MINOR_UNITS = 1_000_000;

/**
 * Whether a payment of `amountMinorUnits` must clear a step-up challenge. The comparison is strictly
 * greater-than — a payment sitting exactly on the threshold clears without a challenge (the boundary
 * case inferred from US-CW-010). Amount and threshold must be in the same currency's minor units.
 */
export function requiresStepUp(
  amountMinorUnits: number,
  thresholdMinorUnits: number = STEP_UP_THRESHOLD_MINOR_UNITS,
): boolean {
  return amountMinorUnits > thresholdMinorUnits;
}
