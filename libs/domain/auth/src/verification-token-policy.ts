const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** True once a sign-up email-verification token is 24 hours or more past its issuance time. */
export function isVerificationTokenExpired(issuedAt: number, now: number): boolean {
  return now - issuedAt >= VERIFICATION_TOKEN_TTL_MS;
}
