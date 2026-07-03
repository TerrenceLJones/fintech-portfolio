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

export interface ForgotPasswordRequest {
  email: string;
}

/** Always identical whether or not the email is registered — see AuthService.requestPasswordReset. */
export type ForgotPasswordResponse = Record<string, never>;

export interface ValidateResetTokenResponse {
  valid: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export type ResetPasswordResponse = Record<string, never>;

export type ResetPasswordErrorCode = 'token_invalid' | 'token_expired' | 'weak_password';

export interface ResetPasswordErrorResponse {
  error: ResetPasswordErrorCode;
}
