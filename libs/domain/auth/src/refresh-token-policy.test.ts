import { describe, expect, it } from 'vitest';
import { classifyRefreshTokenPresentation, isRefreshTokenExpired } from './refresh-token-policy';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('isRefreshTokenExpired', () => {
  it('is not expired immediately after issuance', () => {
    expect(isRefreshTokenExpired(NOW, NOW)).toBe(false);
  });

  it('is not expired at 29 days old', () => {
    expect(isRefreshTokenExpired(NOW - 29 * DAY, NOW)).toBe(false);
  });

  it('is expired at exactly 30 days old', () => {
    expect(isRefreshTokenExpired(NOW - 30 * DAY, NOW)).toBe(true);
  });
});

describe('classifyRefreshTokenPresentation', () => {
  it('classifies a fresh, unused, unrevoked token as valid', () => {
    expect(
      classifyRefreshTokenPresentation({ isUsed: false, isRevoked: false, issuedAt: NOW }, NOW),
    ).toBe('valid');
  });

  it('classifies an already-consumed token as reused', () => {
    expect(
      classifyRefreshTokenPresentation({ isUsed: true, isRevoked: false, issuedAt: NOW }, NOW),
    ).toBe('reused');
  });

  it('classifies a token whose family is revoked as revoked, even if also unused', () => {
    expect(
      classifyRefreshTokenPresentation({ isUsed: false, isRevoked: true, issuedAt: NOW }, NOW),
    ).toBe('revoked');
  });

  it('classifies a token whose family is revoked as revoked, even if also used', () => {
    expect(
      classifyRefreshTokenPresentation({ isUsed: true, isRevoked: true, issuedAt: NOW }, NOW),
    ).toBe('revoked');
  });

  it('classifies an unused, unrevoked, past-TTL token as expired', () => {
    expect(
      classifyRefreshTokenPresentation(
        { isUsed: false, isRevoked: false, issuedAt: NOW - 30 * DAY },
        NOW,
      ),
    ).toBe('expired');
  });

  it('classifies reuse ahead of expiry when both are true', () => {
    expect(
      classifyRefreshTokenPresentation(
        { isUsed: true, isRevoked: false, issuedAt: NOW - 30 * DAY },
        NOW,
      ),
    ).toBe('reused');
  });
});
