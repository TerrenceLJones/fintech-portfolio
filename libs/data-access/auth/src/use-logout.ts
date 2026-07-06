import { useMutation } from '@tanstack/react-query';
import { clearAccessToken } from './access-token-store';

const MAX_RETRIES = 3;

async function postLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    // The user chose to sign out — the client stops acting authenticated regardless of whether
    // the server call itself succeeded, same as a real browser dropping a cookie it can't renew.
    clearAccessToken();
  }
}

export interface UseLogoutOptions {
  /** Overridable for tests — production uses real exponential backoff. */
  retryDelayMs?: (attempt: number) => number;
}

/**
 * Retries a network failure up to MAX_RETRIES times with backoff, same shape as useLogin's AC-05
 * retry. The client already looks signed out after the first attempt's `finally` above — this
 * only gives the server-side revocation (the refresh-token cookie) a few more chances to actually
 * land instead of leaving it live because of what might just be a transient dropped connection.
 * No callers wait on this mutation's outcome, so the extra attempts happen silently in the
 * background.
 */
export function useLogout(options: UseLogoutOptions = {}) {
  const retryDelay = options.retryDelayMs ?? ((attempt: number) => 2 ** attempt * 1000);

  return useMutation({
    mutationFn: postLogout,
    retry: MAX_RETRIES,
    retryDelay,
  });
}
