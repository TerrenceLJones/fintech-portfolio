export interface LoginRequest {
  email: string;
  password: string;
}

/** The refresh token is never in this body — it travels only via the Set-Cookie response header. */
export interface LoginResponse {
  accessToken: string;
}

export type AuthErrorCode = 'invalid_credentials' | 'account_locked' | 'network_error';

export interface AuthErrorResponse {
  error: AuthErrorCode;
  /** Present only when error is 'account_locked'. */
  supportReferenceId?: string;
}
