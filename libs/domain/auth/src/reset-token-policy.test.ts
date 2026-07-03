import { describe, expect, it } from 'vitest';
import { isResetTokenExpired } from './reset-token-policy';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = 1_700_000_000_000;

describe('isResetTokenExpired', () => {
  it('is not expired immediately after issuance', () => {
    expect(isResetTokenExpired(NOW, NOW)).toBe(false);
  });

  it('is not expired at 59 minutes old', () => {
    expect(isResetTokenExpired(NOW - 59 * MINUTE, NOW)).toBe(false);
  });

  it('is expired at exactly 1 hour old', () => {
    expect(isResetTokenExpired(NOW - HOUR, NOW)).toBe(true);
  });

  it('is expired at 61 minutes old', () => {
    expect(isResetTokenExpired(NOW - HOUR - MINUTE, NOW)).toBe(true);
  });
});
