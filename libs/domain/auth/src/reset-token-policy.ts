const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** True once a password-reset token is 1 hour or more past its issuance time. */
export function isResetTokenExpired(issuedAt: number, now: number): boolean {
  return now - issuedAt >= RESET_TOKEN_TTL_MS;
}
