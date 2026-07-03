import { useMutation } from '@tanstack/react-query';
import type { ForgotPasswordRequest, ForgotPasswordResponse } from '@fintech-portfolio/contracts';

async function postForgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  let response: Response;
  try {
    response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('network_error');
  }

  if (!response.ok) {
    throw new Error('network_error');
  }

  return response.json();
}

/**
 * No retry-with-backoff here (unlike useLogin) — the "forgot password" flow has no lockout
 * counter to protect and no AC calling for automatic retry, so a failure just surfaces as an
 * error the page can offer a manual retry for.
 */
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: postForgotPassword });
}
