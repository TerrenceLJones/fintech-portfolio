import { describe, expect, it } from 'vitest';
import { isAccessTokenExpired } from './access-token-policy';

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;

describe('isAccessTokenExpired', () => {
  it('is not expired immediately after issuance', () => {
    expect(isAccessTokenExpired(NOW, NOW)).toBe(false);
  });

  it('is not expired at 4 minutes 59 seconds old', () => {
    expect(isAccessTokenExpired(NOW - (5 * MINUTE - 1000), NOW)).toBe(false);
  });

  it('is expired at exactly 5 minutes old', () => {
    expect(isAccessTokenExpired(NOW - 5 * MINUTE, NOW)).toBe(true);
  });

  it('is expired at 6 minutes old', () => {
    expect(isAccessTokenExpired(NOW - 6 * MINUTE, NOW)).toBe(true);
  });
});
