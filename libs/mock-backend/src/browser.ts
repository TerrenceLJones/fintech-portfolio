// MSW v2 browser worker entry point (dev server / Storybook).
import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth.handlers';
import { passwordResetHandlers } from './handlers/password-reset.handlers';
import { sharedAuthService } from './services/shared-auth-service';

export const worker = setupWorker(...authHandlers, ...passwordResetHandlers);

/**
 * Test-only override for e2e coverage of AC-05 (auth-service-unreachable retry/backoff) — see
 * apps/clearline-web/e2e/login.spec.ts. Only reachable via the window hook main.tsx wires up
 * behind import.meta.env.DEV, so it never ships to production. Playwright's page.route() can't
 * intercept /api/auth/login itself: MSW's Service Worker answers it in-process without a real
 * network transaction, so there's nothing for CDP-level route interception to catch.
 */
export function simulateLoginFailure() {
  worker.use(
    http.post('*/api/auth/login', () =>
      HttpResponse.json({ error: 'internal_error' }, { status: 500 }),
    ),
  );
}

/**
 * Test-only bypass for e2e coverage of the password-reset flow — see
 * apps/clearline-web/e2e/password-reset.spec.ts. AC-01 deliberately makes the forgot-password
 * response identical regardless of whether the email is registered, so the reset token it issues
 * is unrecoverable from the HTTP response by design; in production it only ever reaches the user
 * through an emailed link, and there is no inbox for Playwright to read. This mints a second,
 * independently valid token through the same `sharedAuthService` the real handlers use — issuing
 * a token doesn't invalidate any other outstanding one for that email — so it stands in for "the
 * token from the email" without adding a test-only branch to the request-handling code path.
 * Resolves `undefined` for an unregistered email, exactly like the real flow.
 */
export async function issueResetTokenForE2E(email: string): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestPasswordReset(email);
  return token;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Same as `issueResetTokenForE2E`, but backdated 1 minute past the 1-hour TTL so it's already
 * expired the moment it's issued — for AC-02 e2e coverage. There's no clock-travel hook to age a
 * real token, and `page.route()` can't force a different `/reset-password/validate` response for
 * the same MSW-interception-can't-be-intercepted reason `simulateLoginFailure` exists for login.
 */
export async function issueExpiredResetTokenForE2E(email: string): Promise<string | undefined> {
  const { token } = await sharedAuthService.requestPasswordReset(
    email,
    Date.now() - RESET_TOKEN_TTL_MS - 60_000,
  );
  return token;
}
