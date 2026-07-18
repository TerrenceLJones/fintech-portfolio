import { describe, expect, it } from 'vitest';
import { INVITE_TOKEN_TTL_MS, isInviteTokenExpired } from './invite-token-policy';

describe('isInviteTokenExpired', () => {
  const issuedAt = 1_000_000;

  it('is not expired immediately after issuance', () => {
    expect(isInviteTokenExpired(issuedAt, issuedAt)).toBe(false);
  });

  it('is not expired just before the 7-day TTL elapses', () => {
    expect(isInviteTokenExpired(issuedAt, issuedAt + INVITE_TOKEN_TTL_MS - 1)).toBe(false);
  });

  it('is expired exactly at the 7-day TTL boundary', () => {
    expect(isInviteTokenExpired(issuedAt, issuedAt + INVITE_TOKEN_TTL_MS)).toBe(true);
  });

  it('is expired well past the TTL', () => {
    expect(isInviteTokenExpired(issuedAt, issuedAt + INVITE_TOKEN_TTL_MS * 2)).toBe(true);
  });

  it('uses a 7-day TTL — longer than verification (24h) and reset (1h)', () => {
    expect(INVITE_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
