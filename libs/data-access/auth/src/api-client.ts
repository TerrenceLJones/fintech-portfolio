import type { RefreshResponse, SessionErrorCode } from '@fintech-portfolio/contracts';
import { clearAccessToken, getAccessToken, setAccessToken } from './access-token-store';

export type SessionEndedReason = 'security' | 'expired' | 'password_changed' | 'invalid';

type SessionEndedListener = (reason: SessionEndedReason) => void;

const listeners = new Set<SessionEndedListener>();

/** Subscribes to a forced end-of-session raised by authenticatedFetch (US-CW-002 AC-02/AC-03/AC-06) — e.g. to redirect to /login with the right message. Returns an unsubscribe function. */
export function subscribeSessionEnded(listener: SessionEndedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySessionEnded(reason: SessionEndedReason): void {
  clearAccessToken();
  listeners.forEach((listener) => listener(reason));
}

function toSessionEndedReason(code: SessionErrorCode): SessionEndedReason {
  switch (code) {
    case 'session_revoked_security':
      return 'security';
    case 'session_revoked_password_changed':
      return 'password_changed';
    case 'session_expired':
      return 'expired';
    default:
      return 'invalid';
  }
}

/**
 * 'no-session' means the server gave a definitive answer and there's nothing to recover (already
 * reported via subscribeSessionEnded). 'network-error' means the request itself never completed —
 * distinct from 'no-session' so callers can tell "you're logged out" from "we couldn't tell",
 * and don't have to treat a dropped connection as a forced sign-out.
 */
export type RefreshOutcome = 'success' | 'no-session' | 'network-error';

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Exchanges the httpOnly refresh-token cookie for a new access token. Single-flight: concurrent
 * callers (e.g. several authenticatedFetch calls 401-ing around the same time) share one
 * in-progress request rather than each triggering their own refresh and racing to rotate the
 * family — the second rotation would see the first's new token as already-used and misfire AC-02.
 */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          const body = (await response.json()) as { error: SessionErrorCode };
          notifySessionEnded(toSessionEndedReason(body.error));
          return 'no-session';
        }
        const body: RefreshResponse = await response.json();
        setAccessToken(body.accessToken);
        return 'success';
      } catch {
        // A network failure isn't a session-ending event — leave the caller's original 401 in
        // place so its normal error handling (retry, offline banner, etc.) applies instead of
        // forcing a hard logout for what might just be a dropped connection.
        return 'network-error';
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Fetch wrapper that attaches the in-memory access token and transparently recovers from its
 * expiry (US-CW-002 AC-01): a 401 access_token_expired triggers one silent refresh and replays
 * the original request once. Any other session-ending error code (reuse detected, password
 * changed elsewhere, refresh-token TTL elapsed) is reported via subscribeSessionEnded instead of
 * being retried, since no refresh could recover from those.
 */
export async function authenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${getAccessToken() ?? ''}` },
  });

  if (response.status !== 401) {
    return response;
  }

  const body = (await response.clone().json()) as { error: SessionErrorCode };
  if (body.error !== 'access_token_expired') {
    notifySessionEnded(toSessionEndedReason(body.error));
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (refreshed !== 'success') {
    return response;
  }

  return fetch(input, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${getAccessToken() ?? ''}` },
  });
}
