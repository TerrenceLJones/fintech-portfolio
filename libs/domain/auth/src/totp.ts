/**
 * RFC 6238 TOTP + RFC 4648 Base32, implemented on the Web Crypto API only — no `otpauth`/WASM/native
 * dependency, matching the same service-worker-safe, dependency-free constraint the PBKDF2 helper in
 * `password-hashing` documents. TOTP is HMAC-SHA1 over a 30-second time step; that is enough to
 * interoperate with any authenticator app (Google Authenticator, 1Password, Authy) for US-CW-035's
 * mocked 2FA. The secret is generated and verified here (the "server" side, run inside the MSW worker),
 * while the QR is rendered client-side from `buildOtpauthUri` so the secret never reaches a third-party
 * image service (US-CW-035 AC-03).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** 30-second step is the TOTP default every authenticator app assumes. */
export const TOTP_PERIOD_SECONDS = 30;
/** 6-digit codes, the authenticator-app default. */
export const TOTP_DIGITS = 6;

/** RFC 4648 base32 encode (no padding) — the encoding authenticator apps expect for the shared secret. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** RFC 4648 base32 decode — tolerant of spaces, lowercase, and `=` padding for manual entry. */
export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const cleaned = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/**
 * A fresh, high-entropy base32 TOTP secret (160 bits, the RFC 6238 SHA-1 recommendation). Returned to
 * the client once, embedded in the QR, and stored server-side until setup is verified.
 */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * The `otpauth://totp/...` URI an authenticator app scans. The label is `Issuer:account` and the query
 * repeats the issuer, per the Key URI Format. This string is what the client renders as a QR locally —
 * the secret in it never leaves the browser for a third-party image service (AC-03).
 */
export function buildOtpauthUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = params.issuer ?? 'Clearline';
  const label = encodeURIComponent(`${issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

async function hmacSha1(
  key: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

/** Compute the RFC 6238 TOTP code for a given secret at a given time-step counter. */
async function computeTotpForCounter(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret);
  // 8-byte big-endian counter.
  const message = new Uint8Array(8);
  // Split into high/low 32-bit halves — bit-shifting a JS number past 32 bits is unsafe.
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const hmac = await hmacSha1(key, message);
  // Dynamic truncation (RFC 4226 §5.4). SHA-1 yields 20 bytes, so `offset` is 0–15 and every index
  // below is in range — the non-null assertions just satisfy noUncheckedIndexedAccess.
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

/** The current TOTP code for a secret — used to drive the demo/beacon and tests, not for verification. */
export function generateTotpCode(secret: string, atMs: number): Promise<string> {
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  return computeTotpForCounter(secret, counter);
}

/**
 * Verify a user-entered 6-digit code against the secret, accepting the adjacent time steps within
 * `window` (default ±1 step = ±30s) to tolerate clock skew — the standard authenticator-app allowance.
 * Constant-ish: checks all candidate steps rather than short-circuiting, and compares digit strings.
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  atMs: number,
  window = 1,
): Promise<boolean> {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  let matched = false;
  for (let offset = -window; offset <= window; offset++) {
    const candidate = await computeTotpForCounter(secret, counter + offset);
    if (candidate === normalized) matched = true;
  }
  return matched;
}

/**
 * Ten one-time backup codes in the design's `xxxx-xxxx` hex format (§19.2). Shown exactly once at setup
 * completion (AC-04); only their hashes are retained server-side (AC-06/AC-11), so they can never be
 * re-displayed.
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}
