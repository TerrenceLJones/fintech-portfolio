/**
 * Access token held in a module-scoped variable only — never localStorage, sessionStorage, or
 * React state — per US-CW-001's "in memory only" requirement to limit XSS exfiltration risk.
 * It is lost on page reload by design; the refresh-token cookie is what re-establishes a
 * session afterward.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}
