/**
 * Team-invite tokens live 7 days — deliberately longer than sign-up's 24-hour verification window
 * and password-reset's 1-hour window (US-CW-031 technical_notes): an invite lands on someone who
 * isn't expecting it and may not act immediately, and a compromised invite link only ever grants the
 * role the inviter chose, never takeover of an existing identity. Same single-use, hashed-at-rest
 * token shape as verification and reset tokens.
 */
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** True once a team-invite token is 7 days or more past its issuance time (US-CW-031 AC-03). */
export function isInviteTokenExpired(issuedAt: number, now: number): boolean {
  return now - issuedAt >= INVITE_TOKEN_TTL_MS;
}
