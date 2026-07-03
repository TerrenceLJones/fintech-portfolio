import { describe, expect, it } from 'vitest';
import { isValidPassword } from './password-policy';

describe('isValidPassword', () => {
  it('accepts a passphrase with 10+ chars, upper, lower, and a digit', () => {
    expect(isValidPassword('Correct-Horse-Battery-1')).toBe(true);
  });

  it('rejects a password shorter than 10 characters', () => {
    expect(isValidPassword('Ab1defghi')).toBe(false);
  });

  it('accepts a password exactly 10 characters long', () => {
    expect(isValidPassword('Ab1defghij')).toBe(true);
  });

  it('rejects a password with no uppercase letter', () => {
    expect(isValidPassword('lowercase-1-only')).toBe(false);
  });

  it('rejects a password with no lowercase letter', () => {
    expect(isValidPassword('UPPERCASE-1-ONLY')).toBe(false);
  });

  it('rejects a password with no digit', () => {
    expect(isValidPassword('NoDigitsHereAtAll')).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(isValidPassword('')).toBe(false);
  });
});
