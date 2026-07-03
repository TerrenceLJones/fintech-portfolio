import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hashing';

describe('password hashing', () => {
  it('verifies a password against its own hash', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('correct-password', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('never stores the plaintext password in the hash output', async () => {
    const hash = await hashPassword('correct-password');
    expect(hash).not.toContain('correct-password');
  });

  it('produces a different hash each time due to a random salt', async () => {
    const [first, second] = await Promise.all([hashPassword('correct-password'), hashPassword('correct-password')]);
    expect(first).not.toBe(second);
  });

  it('rejects a malformed or empty stored hash instead of throwing', async () => {
    expect(await verifyPassword('correct-password', '')).toBe(false);
    expect(await verifyPassword('correct-password', 'not-a-real-hash')).toBe(false);
  });
});
