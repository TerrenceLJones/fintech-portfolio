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
}

export type LogoutResponse = Record<string, never>;
