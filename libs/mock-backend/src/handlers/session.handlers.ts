import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  LogoutResponse,
  RefreshResponse,
  SessionErrorResponse,
  SessionResponse,
} from '@clearline/contracts';
import { AuthService, type RevocationReason } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { EXPENSE_CURRENCY } from '../fixtures';
import { parseCookie } from './cookies';
import { MOCKED_CLIENT_IP } from './auth.handlers';

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(token: string): string {
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`;
}

/** Max-Age=0 expires the cookie immediately — used whenever a family dies so the browser doesn't keep sending a dead token. */
function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function revocationErrorCode(reason: RevocationReason | undefined): SessionErrorResponse['error'] {
  return reason === 'password_changed'
    ? 'session_revoked_password_changed'
    : 'session_revoked_security';
}

/** Thin HTTP adapter in front of AuthService's session/token methods — the actual rules live in the service, not here. */
export function createSessionHandlers(authService: AuthService = sharedAuthService): HttpHandler[] {
  return [
    http.post('*/api/auth/refresh', async ({ request }) => {
      const token = parseCookie(request.headers.get('cookie'), REFRESH_COOKIE);
      if (!token) {
        const body: SessionErrorResponse = { error: 'invalid_token' };
        return HttpResponse.json(body, { status: 401 });
      }

      const result = await authService.refresh(token, undefined, MOCKED_CLIENT_IP);

      if (result.outcome === 'success') {
        const body: RefreshResponse = { accessToken: result.accessToken! };
        return HttpResponse.json(body, {
          status: 200,
          headers: { 'set-cookie': setRefreshCookie(result.refreshToken!) },
        });
      }

      const body: SessionErrorResponse = {
        error:
          result.outcome === 'expired'
            ? 'session_expired'
            : result.outcome === 'revoked'
              ? revocationErrorCode(result.reason)
              : result.outcome === 'reused'
                ? 'session_revoked_security'
                : 'invalid_token',
      };
      return HttpResponse.json(body, {
        status: 401,
        headers: { 'set-cookie': clearRefreshCookie() },
      });
    }),

    http.get('*/api/auth/session', ({ request }) => {
      const authHeader = request.headers.get('authorization');
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      if (!accessToken) {
        const body: SessionErrorResponse = { error: 'invalid_token' };
        return HttpResponse.json(body, { status: 401 });
      }

      const result = authService.checkSession(accessToken);

      if (result.outcome === 'active') {
        const body: SessionResponse = {
          userId: result.userId!,
          email: result.email!,
          displayName: result.displayName!,
          role: result.role!,
          approvalLimit: result.approvalLimit!,
          // The demo org is single-currency; approvalLimit and other money figures are in this currency.
          currency: EXPENSE_CURRENCY,
          isAdmin: result.isAdmin!,
          isOwner: result.isOwner!,
          avatarUrl: result.avatarUrl ?? null,
          idleTimeoutMinutes: result.idleTimeoutMinutes!,
          twoFactorSetupRequired: result.twoFactorSetupRequired ?? false,
        };
        return HttpResponse.json(body, { status: 200 });
      }

      const body: SessionErrorResponse = {
        error:
          result.outcome === 'expired'
            ? 'access_token_expired'
            : result.outcome === 'revoked'
              ? revocationErrorCode(result.reason)
              : 'invalid_token',
      };
      return HttpResponse.json(body, { status: 401 });
    }),

    http.post('*/api/auth/logout', async ({ request }) => {
      const token = parseCookie(request.headers.get('cookie'), REFRESH_COOKIE);
      if (token) {
        await authService.logout(token);
      }
      const body: LogoutResponse = {};
      return HttpResponse.json(body, {
        status: 200,
        headers: { 'set-cookie': clearRefreshCookie() },
      });
    }),
  ];
}

export const sessionHandlers = createSessionHandlers();
