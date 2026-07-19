import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ApplyNotificationSummaryRequest,
  ConfirmEmailChangeRequest,
  ConfirmEmailChangeResponse,
  NotificationPrefsResponse,
  NotificationTypeKey,
  ProfileResponse,
  RequestEmailChangeErrorResponse,
  RequestEmailChangeRequest,
  RequestEmailChangeResponse,
  UpdateAvatarRequest,
  UpdateNotificationPrefRequest,
  UpdateProfileRequest,
  ValidateEmailChangeTokenResponse,
} from '@clearline/contracts';
import { AuthService } from '../services/auth.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { bearerToken, unauthorizedForSession } from './session-auth';

/**
 * The personal-profile surface (US-CW-034). Every mutation is self-service — the Profile group needs
 * no permission (AC-10) — so these endpoints authorize by the caller's own active session and act on
 * that account only; there is no cross-user targeting to guard. The identity + notification endpoints
 * are session-bearing; the email-change validate/confirm pair is token-bearing (the link may be
 * opened without a session, exactly like email verification / password reset).
 */
export function createProfileHandlers(authService: AuthService = sharedAuthService): HttpHandler[] {
  /** The caller's active-session login email, or null (the handler then 401s). */
  function callerEmail(request: Request): string | null {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    return session && session.outcome === 'active' ? session.email! : null;
  }

  return [
    http.get('*/api/profile', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const body = authService.getProfile(email)!;
      return HttpResponse.json<ProfileResponse>(body, { status: 200 });
    }),

    http.patch('*/api/profile', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { displayName, phone, jobTitle } = (await request.json()) as UpdateProfileRequest;
      const body = authService.updateProfile(email, { displayName, phone, jobTitle })!;
      return HttpResponse.json<ProfileResponse>(body, { status: 200 });
    }),

    http.post('*/api/profile/avatar', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { avatarUrl } = (await request.json()) as UpdateAvatarRequest;
      const body = authService.setAvatar(email, avatarUrl)!;
      return HttpResponse.json<ProfileResponse>(body, { status: 200 });
    }),

    http.delete('*/api/profile/avatar', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const body = authService.removeAvatar(email)!;
      return HttpResponse.json<ProfileResponse>(body, { status: 200 });
    }),

    http.post('*/api/profile/email-change', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { newEmail } = (await request.json()) as RequestEmailChangeRequest;
      const result = await authService.requestEmailChange(email, newEmail);
      if (result.outcome !== 'success') {
        const error: RequestEmailChangeErrorResponse = { error: result.outcome };
        return HttpResponse.json(error, { status: 422 });
      }
      // The raw token is deliberately NOT returned — it stands in for an emailed link, surfaced in
      // the demo only via the Beacon dev control (issueEmailChangeTokenForE2E), mirroring reset/verify.
      const body: RequestEmailChangeResponse = { pendingEmail: result.pendingEmail! };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.delete('*/api/profile/email-change', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const body = authService.cancelEmailChange(email)!;
      return HttpResponse.json<ProfileResponse>(body, { status: 200 });
    }),

    http.get('*/api/profile/email-change/validate', async ({ request }) => {
      const token = new URL(request.url).searchParams.get('token') ?? '';
      const body: ValidateEmailChangeTokenResponse = {
        valid: await authService.isEmailChangeTokenValid(token),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/profile/email-change/confirm', async ({ request }) => {
      const { token } = (await request.json()) as ConfirmEmailChangeRequest;
      const result = await authService.confirmEmailChange(token);
      const body: ConfirmEmailChangeResponse = { outcome: result.outcome, email: result.email };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/profile/notifications', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const body: NotificationPrefsResponse = {
        preferences: authService.getNotificationPrefs(email)!,
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.patch('*/api/profile/notifications/:key', async ({ request, params }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const patch = (await request.json()) as UpdateNotificationPrefRequest;
      const preferences = authService.setNotificationPref(
        email,
        String(params.key) as NotificationTypeKey,
        { email: patch.email, inApp: patch.inApp, frequency: patch.frequency },
      )!;
      const body: NotificationPrefsResponse = { preferences };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/profile/notifications/summary', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { frequency } = (await request.json()) as ApplyNotificationSummaryRequest;
      const preferences = authService.applyNotificationSummary(email, frequency)!;
      const body: NotificationPrefsResponse = { preferences };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const profileHandlers = createProfileHandlers();
