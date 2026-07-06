export const MAX_DOCUMENT_VERIFICATION_ATTEMPTS = 3;

/** After 3 failed attempts, automatic retries are blocked and a support reference is surfaced instead (US-CW-005 AC-04). */
export function isDocumentVerificationBlocked(attemptCount: number): boolean {
  return attemptCount >= MAX_DOCUMENT_VERIFICATION_ATTEMPTS;
}
