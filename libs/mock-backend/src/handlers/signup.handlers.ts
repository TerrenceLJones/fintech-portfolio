import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  SignUpErrorResponse,
  SignUpRequest,
  SignUpResponse,
  VerifyEmailErrorResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '@fintech-portfolio/contracts';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';

/** Thin HTTP adapter in front of AuthService — the actual rules live in the service, not here. */
export function createSignUpHandlers(authService: AuthService = sharedAuthService): HttpHandler[] {
  return [
    http.post('*/api/auth/signup', async ({ request }) => {
      const { email, password } = (await request.json()) as SignUpRequest;

      // Safe to await, unlike forgot-password's handler: AuthService.signUp pays the same PBKDF2
      // cost on every non-weak-password branch (see its "hashed unconditionally" comment), so
      // response latency can't distinguish a new email from an already-registered one. The
      // weak_password branch alone resolves faster, but that's fine — it's decided before any
      // user lookup, so it carries no registration-status signal to leak.
      const result = await authService.signUp(email, password);
      if (result.outcome === 'weak_password') {
        const body: SignUpErrorResponse = { error: 'weak_password' };
        return HttpResponse.json(body, { status: 422 });
      }

      const body: SignUpResponse = {};
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/auth/verify-email', async ({ request }) => {
      const { token } = (await request.json()) as VerifyEmailRequest;
      const result = await authService.verifyEmail(token);

      if (result.outcome === 'success') {
        const body: VerifyEmailResponse = { accessToken: result.accessToken! };
        return HttpResponse.json(body, {
          status: 200,
          headers: {
            // See auth.handlers.ts's login handler for why this can't be genuinely httpOnly in
            // MSW's browser-mode mock — the pattern is enforced by convention here too.
            'set-cookie': `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/`,
          },
        });
      }

      const body: VerifyEmailErrorResponse = { error: result.outcome };
      return HttpResponse.json(body, { status: 400 });
    }),
  ];
}

export const signUpHandlers = createSignUpHandlers();
