import { describe, expect, it } from 'vitest';
import { generateIdempotencyKey, isUuidV4 } from './idempotency-key';

describe('generateIdempotencyKey', () => {
  it('generates a UUID v4', () => {
    const key = generateIdempotencyKey();
    expect(isUuidV4(key)).toBe(true);
  });

  it('generates a distinct key each call (one per payment intent)', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(50);
  });
});

describe('isUuidV4', () => {
  it('accepts a canonical v4 uuid', () => {
    expect(isUuidV4('8f2a04b1-1c2d-4e3f-8a9b-1234567890c4')).toBe(true);
  });

  it('rejects non-v4 or malformed strings', () => {
    expect(isUuidV4('not-a-uuid')).toBe(false);
    // version nibble 1, not 4
    expect(isUuidV4('8f2a04b1-1c2d-1e3f-8a9b-1234567890c4')).toBe(false);
    expect(isUuidV4('')).toBe(false);
  });
});
