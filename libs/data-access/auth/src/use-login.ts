import { useMutation } from '@tanstack/react-query';
import type { AuthErrorCode, LoginRequest, LoginResponse } from '@fintech-portfolio/contracts';

const MAX_RETRIES = 3;

export class LoginError extends Error {
  readonly code: AuthErrorCode;
  readonly supportReferenceId?: string;

  constructor(code: AuthErrorCode, supportReferenceId?: string) {
    const message = `Login failed: ${code}`;
    super(message);
    this.name = 'LoginError';
    this.code = code;
    this.supportReferenceId = supportReferenceId;
  }
}

async function postLogin(request: LoginRequest): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      // Sends and receives the backend-issued refresh-token cookie.
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('network_error');
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = (await response.json()) as { error: AuthErrorCode; supportReferenceId?: string };
      throw new LoginError(body.error, body.supportReferenceId);
    }
    throw new Error('network_error');
  }

  return response.json();
}

/**
 * Retries network/5xx failures up to MAX_RETRIES times with exponential backoff (US-CW-001
 * AC-05); a LoginError (4xx — wrong password, unregistered email, or lockout) is never retried,
 * since retrying a rejection the server has already made a decision about wouldn't change the
 * outcome and would just hammer the lockout counter further.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && !(error instanceof LoginError);
}

export interface UseLoginOptions {
  /** Overridable for tests — production uses real exponential backoff. */
  retryDelayMs?: (attempt: number) => number;
}

export function useLogin(options: UseLoginOptions = {}) {
  const retryDelay = options.retryDelayMs ?? ((attempt: number) => 2 ** attempt * 1000);

  return useMutation({
    mutationFn: postLogin,
    retry: shouldRetry,
    retryDelay,
  });
}
