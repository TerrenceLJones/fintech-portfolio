/**
 * Rules for the verified email-change flow (US-CW-034 AC-03/AC-04). The confirmation-link machinery
 * itself (single-use, hashed-at-rest token + async dispatch) is reused wholesale from US-CW-029 /
 * US-CW-003 in the mock backend; this module owns only the pure policy the flow needs.
 */

/** Confirmation links expire 24h after issue, matching email verification and password reset. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Case-insensitive, whitespace-trimmed canonical form used for equality and storage. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Whether two addresses are the same account (AC edge case: new === current is rejected). */
export function isSameEmail(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}

// Deliberately permissive: a single "@" with non-empty, dot-bearing domain and no whitespace. The
// mock backend is not an RFC 5322 validator; this only rejects the obviously-malformed before a
// confirmation is sent.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}
