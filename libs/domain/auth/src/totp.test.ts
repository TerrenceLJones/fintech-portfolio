import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  generateBackupCodes,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from './totp';

// RFC 6238 Appendix B reference secret: ASCII "12345678901234567890" (20 bytes).
const RFC_ASCII_SECRET = '12345678901234567890';
const RFC_BASE32_SECRET = base32Encode(new TextEncoder().encode(RFC_ASCII_SECRET));

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 128, 63, 200]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
  });

  it('encodes the RFC 6238 reference secret to the canonical base32', () => {
    expect(RFC_BASE32_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('decodes tolerantly of spaces, lowercase, and padding (manual entry)', () => {
    const canonical = Array.from(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'));
    expect(Array.from(base32Decode('gezd gnbv gy3t qojq gezd gnbv gy3t qojq'))).toEqual(canonical);
  });
});

describe('generateTotpCode (RFC 6238 SHA-1 test vectors)', () => {
  // From RFC 6238 Appendix B; the last 6 digits of the published 8-digit codes.
  it.each([
    [59_000, '287082'],
    [1_111_111_109_000, '081804'],
    [1_234_567_890_000, '005924'],
    [2_000_000_000_000, '279037'],
  ])('T=%dms → %s', async (atMs, expected) => {
    await expect(generateTotpCode(RFC_BASE32_SECRET, atMs)).resolves.toBe(expected);
  });
});

describe('verifyTotpCode', () => {
  it('accepts the current code', async () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = await generateTotpCode(secret, now);
    await expect(verifyTotpCode(secret, code, now)).resolves.toBe(true);
  });

  it('accepts a code from the adjacent step (±30s clock skew)', async () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const previousStep = await generateTotpCode(secret, now - 30_000);
    await expect(verifyTotpCode(secret, previousStep, now)).resolves.toBe(true);
  });

  it('rejects a code two steps away (outside the window)', async () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const stale = await generateTotpCode(secret, now - 120_000);
    await expect(verifyTotpCode(secret, stale, now)).resolves.toBe(false);
  });

  it('rejects a wrong code', async () => {
    const secret = generateTotpSecret();
    await expect(verifyTotpCode(secret, '000000', 1_700_000_000_000)).resolves.toBe(false);
  });

  it('rejects malformed input without throwing', async () => {
    const secret = generateTotpSecret();
    await expect(verifyTotpCode(secret, 'abc', 0)).resolves.toBe(false);
    await expect(verifyTotpCode(secret, '12345', 0)).resolves.toBe(false);
  });

  it('tolerates spaces in the entered code', async () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = await generateTotpCode(secret, now);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    await expect(verifyTotpCode(secret, spaced, now)).resolves.toBe(true);
  });
});

describe('generateTotpSecret', () => {
  it('produces a decodable 20-byte (160-bit) base32 secret', () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it('is different each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('buildOtpauthUri', () => {
  it('builds a scannable otpauth URI with issuer, secret, and standard params', () => {
    const uri = buildOtpauthUri({ secret: 'ABCD', accountName: 'demo@clearline.dev' });
    expect(uri).toContain('otpauth://totp/Clearline%3Ademo%40clearline.dev');
    expect(uri).toContain('secret=ABCD');
    expect(uri).toContain('issuer=Clearline');
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });
});

describe('generateBackupCodes', () => {
  it('produces ten codes in xxxx-xxxx format by default', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
  });

  it('produces distinct codes', () => {
    const codes = generateBackupCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });
});
