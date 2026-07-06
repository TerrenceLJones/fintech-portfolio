export const KYC_OWNERSHIP_THRESHOLD_PERCENT = 25;

/** Owners at or above the threshold must provide individual identity details (name, DOB, SSN/ITIN) — see US-CW-004 AC-05. */
export function requiresKyc(ownershipPercent: number): boolean {
  return ownershipPercent >= KYC_OWNERSHIP_THRESHOLD_PERCENT;
}
