import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AuthErrorResponse, LoginRequest, LoginResponse } from '@fintech-portfolio/contracts';
import { AuthService } from '../services/auth.service';

/**
 * No real client IP is visible to a browser-mode MSW service worker (there is no real network
 * hop to inspect) — this is a fixed placeholder so the audit-event shape has an `ip` field to
 * populate, not a faithful capture. See TDR-CW-WEB-001 > mock_backend_architecture.
 */
const MOCKED_CLIENT_IP = '127.0.0.1 (mocked)';

const defaultAuthService = new AuthService();

/** Thin HTTP adapter in front of AuthService — the actual rules live in the service, not here. */
export function createAuthHandlers(authService: AuthService = defaultAuthService): HttpHandler[] {
  return [
    http.post('*/api/auth/login', async ({ request }) => {
      const { email, password } = (await request.json()) as LoginRequest;
      const result = await authService.login(email, password, MOCKED_CLIENT_IP);

      if (result.outcome === 'success') {
        const body: LoginResponse = { accessToken: result.accessToken! };
        return HttpResponse.json(body, {
          status: 200,
          headers: {
            // NOTE: MSW's browser-mode cookie mocking writes to document.cookie, which cannot
            // be genuinely httpOnly (httpOnly means inaccessible to *any* JS, including MSW's
            // own mechanism). App code must still never read this cookie — the pattern is
            // enforced by convention here, not by the mock. See TDR-CW-WEB-001 >
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

      const body: AuthErrorResponse = { error: 'invalid_credentials' };
      return HttpResponse.json(body, { status: 401 });
    }),
  ];
}

export const authHandlers = createAuthHandlers();
