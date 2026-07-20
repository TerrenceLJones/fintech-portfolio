import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ChangePasswordErrorResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DisableTwoFactorErrorResponse,
  DisableTwoFactorResponse,
  RemoveTrustedDeviceResponse,
  RevokeOtherSessionsResponse,
  RevokeSessionResponse,
  SessionListResponse,
  StartTotpSetupResponse,
  TrustedDeviceListResponse,
  TwoFactorStatus,
  VerifyTotpSetupErrorResponse,
  VerifyTotpSetupRequest,
  VerifyTotpSetupResponse,
} from '@clearline/contracts';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

/**
 * The account-security surface (US-CW-035). Every endpoint is self-service — the Security page is in the
 * Profile group and needs no permission (AC-01–10) — so each authorizes purely by the caller's own active
 * session and acts on that account only; there is no cross-user targeting to guard. Security-sensitive
 * successes emit an immutable audit event via the shared AuditService (AC-11), always resolving the actor
 * from the caller's own session token, and never recording the password, TOTP secret, or backup codes.
 */
export function createSecurityHandlers(
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** The caller's active-session login email, or null (the handler then 401s). */
  function callerEmail(request: Request): string | null {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    return session && session.outcome === 'active' ? session.email! : null;
  }

  /** Record an audit event for the caller, if their session resolves. No-op otherwise. */
  function audit(
    request: Request,
    event: Omit<Parameters<AuditService['record']>[0], 'actor' | 'category'>,
  ): void {
    const actor = resolveAuditActor(request, authService);
    if (actor) auditService.record({ actor, category: 'account_security', ...event });
  }

  return [
    http.post('*/api/security/password', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { currentPassword, newPassword } = (await request.json()) as ChangePasswordRequest;
      const result = await authService.changePassword(email, currentPassword, newPassword);
      if (result.outcome === 'unknown_user') return unauthorizedForSession(request, authService);
      if (result.outcome !== 'success') {
        const error: ChangePasswordErrorResponse = { error: result.outcome };
        return HttpResponse.json(error, { status: 422 });
      }
      audit(request, { action: 'Changed password', target: { label: email } });
      return HttpResponse.json<ChangePasswordResponse>({ ok: true }, { status: 200 });
    }),

    http.get('*/api/security/two-factor', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const status = authService.getTwoFactorStatus(email);
      if (!status) return unauthorizedForSession(request, authService);
      return HttpResponse.json<TwoFactorStatus>(status, { status: 200 });
    }),

    http.post('*/api/security/two-factor/setup', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const setup = authService.startTotpSetup(email);
      if (!setup) return unauthorizedForSession(request, authService);
      // The secret is returned once for the QR/manual entry; no audit event — setup is not yet enabled.
      return HttpResponse.json<StartTotpSetupResponse>(setup, { status: 200 });
    }),

    http.post('*/api/security/two-factor/verify', async ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const { code } = (await request.json()) as VerifyTotpSetupRequest;
      const result = await authService.verifyTotpSetup(email, code);
      if (result.outcome === 'unknown_user') return unauthorizedForSession(request, authService);
      if (result.outcome !== 'success') {
        const error: VerifyTotpSetupErrorResponse = { error: result.outcome };
        return HttpResponse.json(error, { status: 422 });
      }
      audit(request, {
        action: 'Enabled two-factor authentication',
        diff: { from: 'Off', to: 'On', tone: 'positive' },
      });
      return HttpResponse.json<VerifyTotpSetupResponse>(
        { backupCodes: result.backupCodes },
        { status: 200 },
      );
    }),

    http.post('*/api/security/two-factor/disable', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const result = authService.disableTwoFactor(email);
      if (result.outcome === 'unknown_user') return unauthorizedForSession(request, authService);
      if (result.outcome === 'org_enforced') {
        const error: DisableTwoFactorErrorResponse = { error: 'org_enforced' };
        return HttpResponse.json(error, { status: 403 });
      }
      audit(request, {
        action: 'Disabled two-factor authentication',
        diff: { from: 'On', to: 'Off', tone: 'warning' },
      });
      return HttpResponse.json<DisableTwoFactorResponse>({ ok: true }, { status: 200 });
    }),

    http.get('*/api/security/sessions', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const sessions = authService.listSessions(email);
      if (!sessions) return unauthorizedForSession(request, authService);
      return HttpResponse.json<SessionListResponse>({ sessions }, { status: 200 });
    }),

    http.delete('*/api/security/sessions/:id', ({ request, params }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const sessionId = String(params.id);
      // Capture the device label BEFORE revoking, for the audit event.
      const target = authService.listSessions(email)?.find((s) => s.id === sessionId);
      const revoked = authService.revokeSession(email, sessionId);
      if (revoked && target) {
        audit(request, {
          action: 'Signed out a device',
          target: { label: `${target.browser} · ${target.city}`, ref: sessionId },
        });
      }
      // Idempotent: a session already gone is not an error (edge case).
      return HttpResponse.json<RevokeSessionResponse>({ ok: true }, { status: 200 });
    }),

    http.post('*/api/security/sessions/revoke-others', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const revokedCount = authService.revokeOtherSessions(email);
      if (revokedCount === null) return unauthorizedForSession(request, authService);
      if (revokedCount > 0) {
        audit(request, {
          action: 'Signed out all other devices',
          detail: `${revokedCount} device${revokedCount === 1 ? '' : 's'}`,
        });
      }
      return HttpResponse.json<RevokeOtherSessionsResponse>({ revokedCount }, { status: 200 });
    }),

    http.get('*/api/security/trusted-devices', ({ request }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const devices = authService.listTrustedDevices(email);
      if (!devices) return unauthorizedForSession(request, authService);
      return HttpResponse.json<TrustedDeviceListResponse>({ devices }, { status: 200 });
    }),

    http.delete('*/api/security/trusted-devices/:id', ({ request, params }) => {
      const email = callerEmail(request);
      if (!email) return unauthorizedForSession(request, authService);
      const deviceId = String(params.id);
      const target = authService.listTrustedDevices(email)?.find((d) => d.id === deviceId);
      const removed = authService.removeTrustedDevice(email, deviceId);
      if (removed && target) {
        audit(request, {
          action: 'Removed a trusted device',
          target: { label: target.label, ref: deviceId },
        });
      }
      return HttpResponse.json<RemoveTrustedDeviceResponse>({ ok: true }, { status: 200 });
    }),
  ];
}

export const securityHandlers = createSecurityHandlers();
