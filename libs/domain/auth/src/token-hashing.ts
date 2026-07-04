function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 via the Web Crypto API — deliberately not the slow PBKDF2 helper in `password-hashing`.
 * A reset or verification token is already high-entropy (derived from `crypto.randomUUID()`),
 * unlike a user-chosen password, so it needs no deliberately-expensive key derivation to resist
 * brute force. Per the OWASP Forgot Password Cheat Sheet, hashing it at rest is defense-in-depth
 * against a store compromise (a leaked hash can't be replayed as a valid link), not a brute-force
 * mitigation. Shared by both the password-reset token (US-CW-003) and the sign-up email-
 * verification token (US-CW-029) — same shape, same guarantees, no reason for two copies.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}
