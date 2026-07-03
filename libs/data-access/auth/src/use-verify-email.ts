import { useQuery } from '@tanstack/react-query';
import type {
  VerifyEmailErrorCode,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '@fintech-portfolio/contracts';

export class VerifyEmailError extends Error {
  readonly code: VerifyEmailErrorCode;

  constructor(code: VerifyEmailErrorCode) {
    super(code);
    this.name = 'VerifyEmailError';
    this.code = code;
  }
}

async function postVerifyEmail(request: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  let response: Response;
  try {
    response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('network_error');
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      const body = (await response.json()) as { error: VerifyEmailErrorCode };
      throw new VerifyEmailError(body.error);
    }
    throw new Error('network_error');
  }

  return response.json();
}

/**
 * Modeled as a `useQuery`, not a `useMutation`, even though verify-email is a side-effecting POST
 * (it consumes a single-use token) — same reasoning as useValidateResetToken. React Query's
 * queryKey-based caching means a duplicate call for the same token (e.g. React 18 StrictMode's
 * dev-only double-invoke of effects) is deduped rather than re-sent, so the token can't be
 * accidentally burned twice by the page's own render behavior. Disabled until a token is present.
 *
 * `gcTime: 0` deliberately opts this query out of React Query's default cache retention: if a
 * reused (already-consumed) token is visited a second time — e.g. via browser back, or a second
 * click on the same emailed link — a cached success result must not resurface. Without this, a
 * remounted VerifyEmailPage would synchronously render the prior success before its background
 * refetch (which correctly gets token_invalid) resolves, and the page's own redirect-on-success
 * effect would fire off that stale data before the real, rejected outcome ever had a chance to
 * render.
 */
export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => postVerifyEmail({ token: token! }),
    enabled: token != null && token.length > 0,
    retry: false,
    gcTime: 0,
  });
}
