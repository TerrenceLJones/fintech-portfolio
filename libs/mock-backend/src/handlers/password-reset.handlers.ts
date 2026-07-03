import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordErrorResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ValidateResetTokenResponse,
} from '@fintech-portfolio/contracts';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';

/** Thin HTTP adapter in front of AuthService — the actual rules live in the service, not here. */
export function createPasswordResetHandlers(
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.post('*/api/auth/forgot-password', async ({ request }) => {
      const { email } = (await request.json()) as ForgotPasswordRequest;
      // Deliberately not awaited: requestPasswordReset does strictly more work for a registered
      // email (mint + hash a token) than for an unregistered one (immediate return), so awaiting
      // it here would let response latency leak which case happened — the exact side channel
      // AC-01 and the response body itself are designed to close. Firing it and responding
      // immediately decouples the two. Any rejection is swallowed since there's no caller left
      // to observe it once the response has gone out.
      void authService.requestPasswordReset(email).catch(() => {});

      const body: ForgotPasswordResponse = {};
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/auth/reset-password/validate', async ({ request }) => {
      const token = new URL(request.url).searchParams.get('token') ?? '';
      const body: ValidateResetTokenResponse = {
        valid: await authService.isResetTokenValid(token),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/auth/reset-password', async ({ request }) => {
      const { token, password } = (await request.json()) as ResetPasswordRequest;
      const result = await authService.resetPassword(token, password);

      if (result.outcome === 'success') {
        const body: ResetPasswordResponse = {};
        return HttpResponse.json(body, { status: 200 });
      }

      if (result.outcome === 'weak_password') {
        const body: ResetPasswordErrorResponse = { error: 'weak_password' };
        return HttpResponse.json(body, { status: 422 });
      }

      const body: ResetPasswordErrorResponse = { error: result.outcome };
      return HttpResponse.json(body, { status: 400 });
    }),
  ];
}

export const passwordResetHandlers = createPasswordResetHandlers();
