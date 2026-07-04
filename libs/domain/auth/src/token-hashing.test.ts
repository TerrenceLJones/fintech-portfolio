import { describe, expect, it } from 'vitest';
import { hashToken } from './token-hashing';

describe('hashToken', () => {
  it('is deterministic for the same input', async () => {
    const a = await hashToken('reset_abc');
    const b = await hashToken('reset_abc');
    expect(a).toBe(b);
  });

  it('produces different hashes for different tokens', async () => {
    const a = await hashToken('reset_abc');
    const b = await hashToken('reset_def');
    expect(a).not.toBe(b);
  });

  it('never returns the input token itself', async () => {
    const hash = await hashToken('reset_abc');
    expect(hash).not.toBe('reset_abc');
  });

  it('returns a 64-character lowercase hex string (SHA-256)', async () => {
    const hash = await hashToken('reset_abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
