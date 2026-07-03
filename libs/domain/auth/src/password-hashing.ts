const HASH_PREFIX = 'pbkdf2-sha256';
/** OWASP Password Storage Cheat Sheet's documented fallback iteration count for PBKDF2-HMAC-SHA256. */
const DEFAULT_ITERATIONS = 210_000;
const SALT_LENGTH_BYTES = 16;
const DERIVED_KEY_LENGTH_BITS = 256;

export interface HashPasswordOptions {
  iterations?: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    DERIVED_KEY_LENGTH_BITS,
  );
  return new Uint8Array(derivedBits);
}

/**
 * PBKDF2-HMAC-SHA256 via the Web Crypto API (`crypto.subtle`), which is natively available and
 * identical in both runtimes this mock backend executes in: the browser-mode MSW service worker
 * and Node/Vitest. Argon2id is OWASP's first-choice algorithm but has no native Web Crypto
 * support, which would mean shipping a WASM dependency into the service worker bundle; PBKDF2 is
 * OWASP's documented fallback for when Argon2id/bcrypt/scrypt aren't available. Never use this
 * pattern to make a password recoverable — hashing is one-way by design. See
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.
 */
export async function hashPassword(
  password: string,
  { iterations = DEFAULT_ITERATIONS }: HashPasswordOptions = {},
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const derived = await derive(password, salt, iterations);
  return `${HASH_PREFIX}$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

/** Re-derives the hash from the candidate password using the stored salt/iterations, then compares in constant time. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, iterationsRaw, saltB64, hashB64] = storedHash.split('$');
  if (prefix !== HASH_PREFIX || !iterationsRaw || !saltB64 || !hashB64) {
    return false;
  }

  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const actual = await derive(password, salt, Number(iterationsRaw));

  if (actual.length !== expected.length) {
    return false;
  }
  // XOR-accumulate every byte rather than short-circuiting on the first mismatch, so comparison
  // time doesn't leak how many leading bytes matched (timing attack).
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i]! ^ expected[i]!;
  }
  return diff === 0;
}
