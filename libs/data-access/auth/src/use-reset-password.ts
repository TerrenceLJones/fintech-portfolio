import { useMutation } from '@tanstack/react-query';
import type {
  ResetPasswordErrorCode,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@fintech-portfolio/contracts';

export class ResetPasswordError extends Error {
  readonly code: ResetPasswordErrorCode;

  constructor(code: ResetPasswordErrorCode) {
    super(code);
    this.code = code;
  }
}

async function postResetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  let response: Response;
  try {
    response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('network_error');
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = (await response.json()) as { error: ResetPasswordErrorCode };
      throw new ResetPasswordError(body.error);
    }
    throw new Error('network_error');
  }

  return response.json();
}

export function useResetPassword() {
  return useMutation({ mutationFn: postResetPassword });
}
