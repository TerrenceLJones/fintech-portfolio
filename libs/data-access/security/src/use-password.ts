import { useMutation } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ChangePasswordErrorCode,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from '@clearline/contracts';

/** Typed rejection of a password change so the form can show the right inline message (US-CW-035 AC-02). */
export class ChangePasswordError extends Error {
  readonly code: ChangePasswordErrorCode;
  constructor(code: ChangePasswordErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Change the signed-in user's password (AC-01/02). No cache to prime — the change does not alter the
 * profile or session (other sessions are deliberately NOT revoked), so success just resolves.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (request: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
      const response = await authenticatedFetch('/api/security/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          const body = (await response.json()) as { error: ChangePasswordErrorCode };
          throw new ChangePasswordError(body.error);
        }
        throw new Error('change_password_failed');
      }
      return response.json();
    },
  });
}
