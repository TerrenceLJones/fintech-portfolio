import { describe, expect, it } from 'vitest';
import { isSameEmail, isValidEmail, normalizeEmail } from './email-change-policy';

describe('email-change policy', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeEmail('  New@Example.COM ')).toBe('new@example.com');
  });

  it('treats case/whitespace-different addresses as the same account (AC edge case)', () => {
    expect(isSameEmail('user@clearline.dev', 'USER@clearline.dev ')).toBe(true);
    expect(isSameEmail('user@clearline.dev', 'other@clearline.dev')).toBe(false);
  });

  it('accepts a plausible address and rejects the obviously-malformed', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('two spaces@x.com')).toBe(false);
  });
});
