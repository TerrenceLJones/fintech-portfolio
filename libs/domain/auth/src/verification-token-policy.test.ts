import { describe, expect, it } from 'vitest';
import { isVerificationTokenExpired } from './verification-token-policy';

describe('verification token policy', () => {
  const ISSUED_AT = 1_000_000;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  it('is not expired immediately after issuance', () => {
    expect(isVerificationTokenExpired(ISSUED_AT, ISSUED_AT)).toBe(false);
  });

  it('is not expired just under 24 hours later', () => {
    expect(isVerificationTokenExpired(ISSUED_AT, ISSUED_AT + TWENTY_FOUR_HOURS_MS - 1)).toBe(false);
  });

  it('is expired at exactly 24 hours', () => {
    expect(isVerificationTokenExpired(ISSUED_AT, ISSUED_AT + TWENTY_FOUR_HOURS_MS)).toBe(true);
  });

  it('is expired well past 24 hours', () => {
    expect(isVerificationTokenExpired(ISSUED_AT, ISSUED_AT + TWENTY_FOUR_HOURS_MS + 60_000)).toBe(
      true,
    );
  });
});
