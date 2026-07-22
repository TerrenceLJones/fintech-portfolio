import type { Role } from './rbac';

/** The rotated refresh token is never in this body — it travels only via the Set-Cookie response header, same as login/verify-email. */
export interface RefreshResponse {
  accessToken: string;
}

export type SessionErrorCode =
  | 'access_token_expired'
  | 'invalid_token'
  | 'session_revoked_security'
  | 'session_revoked_password_changed'
  | 'session_expired';

export interface SessionErrorResponse {
  error: SessionErrorCode;
}

export interface SessionResponse {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  /**
   * Approval limit in minor units; null = unlimited (Controller). Re-read from the server on each
   * session check so a mid-session change is reflected on the next request (US-CW-006 AC-05).
   * Employees carry no approvals:act permission regardless of this value.
   */
  approvalLimit: number | null;
  /**
   * The organization's currency (ISO 4217) that approvalLimit and other org money figures are
   * denominated in — server-sourced (the org is single-currency, per ExpenseContextResponse) so the
   * client can format the approval limit without assuming USD.
   */
  currency: string;
  /** Orthogonal to the approval tier — grants team:view only, never approval authority. */
  isAdmin: boolean;
  /**
   * The account creator, elevated to Owner when their business clears KYB (US-CW-030). Orthogonal to
   * both the approval tier and isAdmin, and — in this epic — grants no permissions on its own; the
   * team-management authority of ownership is layered on in EPIC-CW-018.
   */
  isOwner: boolean;
  /**
   * Data URL of the user's avatar, or null when it falls back to initials. Sourced here so the
   * sidebar identity footer is a single avatar source of truth: changing it on Personal Info
   * (US-CW-034 AC-05) invalidates the session query and the chip updates live.
   */
  avatarUrl: string | null;
  /**
   * The org-configured idle auto-logoff duration in minutes (US-CW-040 AC-05). The per-user inactivity
   * timer (US-CW-002) reads this rather than a hardcoded 15 minutes, so an org change to the timeout
   * takes effect on the member's next session check without a hardcoded value anywhere in the client.
   */
  idleTimeoutMinutes: number;
  /**
   * True when this member must complete 2FA setup before reaching any other screen (US-CW-040 AC-04).
   * Stamped at login time: it is only ever true for a session minted AFTER the org enforced 2FA while
   * the member was still unenrolled — a member already mid-session is never forced (edge case), and it
   * clears the moment they finish setup. The login-flow gate keys off this flag.
   */
  twoFactorSetupRequired: boolean;
}

export type LogoutResponse = Record<string, never>;
