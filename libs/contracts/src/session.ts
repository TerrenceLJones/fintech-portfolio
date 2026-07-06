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
}

export type LogoutResponse = Record<string, never>;
