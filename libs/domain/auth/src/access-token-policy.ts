const ACCESS_TOKEN_TTL_MS = 5 * 60 * 1000;

/** True once an access token is 5 minutes or more past its issuance time. */
export function isAccessTokenExpired(issuedAt: number, now: number): boolean {
  return now - issuedAt >= ACCESS_TOKEN_TTL_MS;
}
