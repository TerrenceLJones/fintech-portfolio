import { describe, expect, it } from 'vitest';
import { hashResetToken } from './reset-token-hashing';

describe('hashResetToken', () => {
  it('is deterministic for the same input', async () => {
    const a = await hashResetToken('reset_abc');
    const b = await hashResetToken('reset_abc');
    expect(a).toBe(b);
  });

  it('produces different hashes for different tokens', async () => {
    const a = await hashResetToken('reset_abc');
    const b = await hashResetToken('reset_def');
    expect(a).not.toBe(b);
  });

  it('never returns the input token itself', async () => {
    const hash = await hashResetToken('reset_abc');
    expect(hash).not.toBe('reset_abc');
  });

  it('returns a 64-character lowercase hex string (SHA-256)', async () => {
    const hash = await hashResetToken('reset_abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
