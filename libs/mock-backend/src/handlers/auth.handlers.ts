import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AuthErrorResponse, LoginRequest, LoginResponse } from '@fintech-portfolio/contracts';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';

/**
 * No real client IP is visible to a browser-mode MSW service worker (there is no real network
 * hop to inspect) — this is a fixed placeholder so the audit-event shape has an `ip` field to
 * populate, not a faithful capture. See TDR-CW-WEB-001 > mock_backend_architecture. Exported so
 * session.handlers.ts's refresh handler can populate the same field on its own audit events
 * (refresh_token_reuse_detected) rather than duplicating this literal.
 */
export const MOCKED_CLIENT_IP = '127.0.0.1 (mocked)';

/** Thin HTTP adapter in front of AuthService — the actual rules live in the service, not here. */
export function createAuthHandlers(authService: AuthService = sharedAuthService): HttpHandler[] {
  return [
    http.post('*/api/auth/login', async ({ request }) => {
      const { email, password } = (await request.json()) as LoginRequest;
      const result = await authService.login(email, password, MOCKED_CLIENT_IP);

      if (result.outcome === 'success') {
        const body: LoginResponse = {
          accessToken: result.accessToken!,
          hasOtherActiveSession: result.hasOtherActiveSession!,
        };
        return HttpResponse.json(body, {
          status: 200,
          headers: {
            // NOTE: `Set-Cookie` is a forbidden response header per the Fetch spec — browsers
            // refuse to apply it whether the response came from a real network hop or (as here) a
            // Service Worker's synthetic Response, so this header is never actually stored by the
            // browser in browser-mode MSW; confirmed empirically (both document.cookie and
            // page.context().cookies() are empty after login in a real Playwright/Chromium run,
            // even though this header is present on the mocked response — see
            // apps/clearline-web/e2e/login.spec.ts's AC-01 test, which already works around this
            // for cookie *inspection*, and apps/clearline-web/e2e/session.spec.ts, which works
            // around it for refresh-flow e2e coverage by overriding the refresh handler directly
            // rather than relying on a real cookie round-trip). Still set here so the Node-based
            // MSW interceptor (used by every Vitest-level test in this repo, including this
            // file's own handler tests) DOES apply it via its real cookie jar, and so this
            // response shape matches what a real backend would send. See TDR-CW-WEB-001 >
            // mock_backend_architecture.
            'set-cookie': `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/`,
          },
        });
      }

      if (result.outcome === 'account_locked') {
        const body: AuthErrorResponse = {
          error: 'account_locked',
          supportReferenceId: result.supportReferenceId,
        };
        return HttpResponse.json(body, { status: 423 });
      }

      if (result.outcome === 'unverified_account') {
        const body: AuthErrorResponse = { error: 'unverified_account' };
        return HttpResponse.json(body, { status: 403 });
      }

      const body: AuthErrorResponse = { error: 'invalid_credentials' };
      return HttpResponse.json(body, { status: 401 });
    }),
  ];
}

export const authHandlers = createAuthHandlers();
