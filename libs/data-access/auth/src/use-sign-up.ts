import { useMutation } from '@tanstack/react-query';
import type { SignUpErrorCode, SignUpRequest, SignUpResponse } from '@fintech-portfolio/contracts';

export class SignUpError extends Error {
  readonly code: SignUpErrorCode;

  constructor(code: SignUpErrorCode) {
    super(code);
    this.name = 'SignUpError';
    this.code = code;
  }
}

async function postSignUp(request: SignUpRequest): Promise<SignUpResponse> {
  let response: Response;
  try {
    response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('network_error');
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = (await response.json()) as { error: SignUpErrorCode };
      throw new SignUpError(body.error);
    }
    throw new Error('network_error');
  }

  return response.json();
}

/**
 * No retry-with-backoff, same rationale as useRequestPasswordReset — no lockout counter to
 * protect and no AC calling for automatic retry, so a failure just surfaces as an error the page
 * can offer a manual "Resend"/retry for.
 */
export function useSignUp() {
  return useMutation({ mutationFn: postSignUp });
}
