// MSW v2 browser worker entry point (dev server / Storybook).
import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import type { SessionErrorCode } from '@clearline/contracts';
import { authHandlers } from './handlers/auth.handlers';
import { passwordResetHandlers } from './handlers/password-reset.handlers';
import { signUpHandlers } from './handlers/signup.handlers';
import { sessionHandlers } from './handlers/session.handlers';
import { onboardingHandlers } from './handlers/onboarding.handlers';
import { sharedAuthService } from './services/shared-auth-service';

export const worker = setupWorker(
  ...authHandlers,
  ...passwordResetHandlers,
  ...signUpHandlers,
  ...sessionHandlers,
  ...onboardingHandlers,
);

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

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Test-only bypass for e2e coverage of the sign-up flow — see apps/clearline-web/e2e/signup.spec.ts.
 * Same rationale as issueResetTokenForE2E: AC-01's verification token never appears in the HTTP
 * response, only in an email there's no inbox for Playwright to read. Calling signUp again for an
 * email that already has an unverified account (the one the real UI flow just created) mints a
 * second, independently valid token for that same account rather than creating a duplicate one —
 * see AuthService.signUp's "already registered but NOT verified" branch. Resolves `undefined` if
 * the email is already verified, since there's nothing left to verify.
 */
export async function issueVerificationTokenForE2E(
  email: string,
  password: string,
): Promise<string | undefined> {
  const { verificationToken } = await sharedAuthService.signUp(email, password);
  return verificationToken;
}

/**
 * Same as `issueVerificationTokenForE2E`, but backdated 1 minute past the 24-hour TTL so it's
 * already expired the moment it's issued — for AC-05 e2e coverage.
 */
export async function issueExpiredVerificationTokenForE2E(
  email: string,
  password: string,
): Promise<string | undefined> {
  const { verificationToken } = await sharedAuthService.signUp(
    email,
    password,
    Date.now() - VERIFICATION_TOKEN_TTL_MS - 60_000,
  );
  return verificationToken;
}

/**
 * Test-only bypass for US-CW-002 AC-01 e2e coverage: there's no way to fast-forward a real
 * browser's clock, so this backdates the signed-in account's access token(s) directly via
 * AuthService rather than waiting out the real TTL. The refresh-token cookie is left untouched,
 * so the very next authenticated request should 401 with access_token_expired and the app's
 * silent-refresh interceptor should recover it transparently.
 */
export function expireAccessTokenForE2E(email: string): void {
  sharedAuthService.expireAccessTokensForE2E(email);
}

export type SimulatedRefreshOutcome = 'success' | 'reused' | 'expired' | 'password_changed';

/**
 * Test-only override of POST /api/auth/refresh for e2e coverage of US-CW-002 AC-01 (success),
 * AC-02 (reused), AC-03 (expired) and AC-06 (password_changed)'s client-side reaction to each
 * outcome — same worker.use() override pattern as simulateLoginFailure, and for the same
 * page.route()-can't-intercept-an-in-process-Service-Worker reason.
 *
 * This exists because the real family/token bookkeeping (AuthService.refresh) can't be exercised
 * through an actual browser round trip here: `Set-Cookie` is a forbidden response header per the
 * Fetch spec, so browsers never apply it from a Service Worker's synthetic Response — confirmed
 * empirically (document.cookie and page.context().cookies() are both empty after login in a real
 * Playwright/Chromium run) — meaning the refresh-token cookie the login handler "sets" never
 * actually reaches the browser's cookie jar, and every subsequent request that would normally
 * carry it sends none at all. That bookkeeping is already thoroughly covered where MSW's Node
 * interceptor doesn't have this restriction: auth.service.session.test.ts (unit) and
 * session.handlers.test.ts (Node-http integration, via a real shared cookie jar). This hook lets
 * e2e instead verify what it uniquely can: that the app's own interceptor and UI correctly react
 * to each server outcome in a real browser.
 *
 * `email` is only used for the 'success' outcome — it identifies which account's family to mint
 * a properly-registered replacement access token against (see AuthService.mintAccessTokenForE2E),
 * since a bare random string wouldn't pass the very next checkSession() call the app makes.
 */
export function simulateRefreshOutcomeForE2E(
  outcome: SimulatedRefreshOutcome,
  email: string,
): void {
  if (outcome === 'success') {
    worker.use(
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ accessToken: sharedAuthService.mintAccessTokenForE2E(email) }),
      ),
    );
    return;
  }

  const error: SessionErrorCode =
    outcome === 'reused'
      ? 'session_revoked_security'
      : outcome === 'password_changed'
        ? 'session_revoked_password_changed'
        : 'session_expired';

  worker.use(http.post('*/api/auth/refresh', () => HttpResponse.json({ error }, { status: 401 })));
}
