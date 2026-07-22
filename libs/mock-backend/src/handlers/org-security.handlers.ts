import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AddIpRangeRequest,
  IdleTimeoutMinutes,
  OrgSecurityErrorResponse,
  OrgSecurityResponse,
  RemoveIpRangeRequest,
  SetIdleTimeoutRequest,
  SetSsoEnabledRequest,
  SetTwoFactorEnforcementRequest,
  SsoConfig,
  TestSsoRequest,
  TestSsoResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import {
  canEnableSso,
  certificateFingerprint,
  evaluateSsoTest,
  idleTimeoutLabel,
  isValidCidr,
  isValidIdleTimeout,
  wouldLockOut,
} from '@clearline/domain-org-security';
import { DEMO_CURRENT_IP } from '../fixtures/org-security.fixture';
import { AuditService } from '../services/audit.service';
import { AuthService, type StoredOrgSecurity } from '../services/auth.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

function toResponse(security: StoredOrgSecurity): OrgSecurityResponse {
  return {
    sso: { ...security.sso } as SsoConfig,
    requireTwoFactor: security.requireTwoFactor,
    idleTimeoutMinutes: security.idleTimeoutMinutes as IdleTimeoutMinutes,
    ipAllowlist: [...security.ipAllowlist],
    currentIp: DEMO_CURRENT_IP,
  };
}

/** One-line SSO summary for an audit diff — never the certificate, only its fingerprint (AC-10). */
function ssoSummary(security: StoredOrgSecurity): string {
  const { sso } = security;
  const test = sso.lastTest ? sso.lastTest.result : 'untested';
  return `${sso.enabled ? 'enabled' : 'disabled'} · ${sso.metadataUrl ?? 'no metadata'} · cert ${
    sso.certificateFingerprint ?? 'none'
  } · test ${test}`;
}

export function createOrgSecurityHandlers(
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** org-security:manage gate — Admin/Owner only. Returns the caller's orgId, else a 401/403 status. */
  function authorizeOrg(
    request: Request,
  ): { ok: true; orgId: string } | { ok: false; status: 401 | 403 } {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    if (!session || session.outcome !== 'active') return { ok: false, status: 401 };

    const permissions = permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    });
    if (!hasPermission(permissions, 'org-security:manage')) return { ok: false, status: 403 };

    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { ok: false, status: 403 };
    return { ok: true, orgId };
  }

  function forbidden() {
    const body: OrgSecurityErrorResponse = { error: 'forbidden_role' };
    return HttpResponse.json(body, { status: 403 });
  }

  function error(code: OrgSecurityErrorResponse['error'], detail?: string, status = 422) {
    const body: OrgSecurityErrorResponse = detail ? { error: code, detail } : { error: code };
    return HttpResponse.json(body, { status });
  }

  function record(
    request: Request,
    action: string,
    extra: { diff?: { from: string; to: string }; target?: { label: string } },
  ) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({ actor, category: 'org_security', action, ...extra });
  }

  return [
    http.get('*/api/org-security', ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      return HttpResponse.json<OrgSecurityResponse>(
        toResponse(authService.getOrgSecurity(authz.orgId)!),
        { status: 200 },
      );
    }),

    // Enter SSO config + run the mocked SAML handshake (AC-01). The certificate is used only to evaluate
    // the handshake and then discarded — only its fingerprint is persisted (AC-10).
    http.post('*/api/org-security/sso/test', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as TestSsoRequest;
      const test = evaluateSsoTest(body);
      const after = authService.setSsoConfig(authz.orgId, {
        metadataUrl: body.metadataUrl,
        entityId: body.entityId,
        certificateFingerprint: certificateFingerprint(body.certificate),
        lastTest: test,
      })!;
      record(request, `SSO connection test ${test.result}`, {
        diff: { from: 'configuration', to: ssoSummary(after) },
      });
      return HttpResponse.json<TestSsoResponse>(
        { result: test.result, reason: test.reason, sso: { ...after.sso } as SsoConfig },
        { status: 200 },
      );
    }),

    // Toggle SSO on/off (AC-02). Enabling requires a passed connection test — the server independently
    // enforces the guardrail regardless of what the client renders.
    http.post('*/api/org-security/sso/enabled', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as SetSsoEnabledRequest;
      const current = authService.getOrgSecurity(authz.orgId)!;
      if (body.enabled && !canEnableSso(current.sso)) {
        return error('sso_test_required');
      }
      const after = authService.setSsoEnabled(authz.orgId, body.enabled)!;
      record(request, body.enabled ? 'Enabled SSO' : 'Disabled SSO', {
        diff: { from: ssoSummary(current), to: ssoSummary(after) },
      });
      return HttpResponse.json<OrgSecurityResponse>(toResponse(after), { status: 200 });
    }),

    // Enforce or relax org-wide mandatory 2FA (AC-03). Members without 2FA are gated on their next login.
    http.post('*/api/org-security/two-factor', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as SetTwoFactorEnforcementRequest;
      const before = authService.getOrgSecurity(authz.orgId)!;
      const after = authService.setTwoFactorEnforcement(authz.orgId, body.requireTwoFactor)!;
      record(request, body.requireTwoFactor ? 'Enabled required 2FA' : 'Disabled required 2FA', {
        diff: {
          from: before.requireTwoFactor ? 'required' : 'optional',
          to: after.requireTwoFactor ? 'required' : 'optional',
        },
      });
      return HttpResponse.json<OrgSecurityResponse>(toResponse(after), { status: 200 });
    }),

    // Change the org idle auto-logoff duration (AC-05); every member's timer reads this value.
    http.post('*/api/org-security/idle-timeout', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as SetIdleTimeoutRequest;
      if (!isValidIdleTimeout(body.idleTimeoutMinutes)) return error('invalid_timeout');
      const before = authService.getOrgSecurity(authz.orgId)!;
      const after = authService.setIdleTimeout(authz.orgId, body.idleTimeoutMinutes)!;
      record(request, 'Changed idle session timeout', {
        diff: {
          from: idleTimeoutLabel(before.idleTimeoutMinutes),
          to: idleTimeoutLabel(after.idleTimeoutMinutes),
        },
      });
      return HttpResponse.json<OrgSecurityResponse>(toResponse(after), { status: 200 });
    }),

    // Add a CIDR range (AC-06). Refused if it's malformed, a duplicate, or would exclude the acting
    // admin's own current IP — the self-lockout guard names the excluded IP (AC-07).
    http.post('*/api/org-security/ip-allowlist', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as AddIpRangeRequest;
      if (!isValidCidr(body.cidr)) return error('invalid_cidr', body.cidr);
      const current = authService.getOrgSecurity(authz.orgId)!;
      if (current.ipAllowlist.includes(body.cidr)) return error('duplicate_range', body.cidr);
      if (wouldLockOut(DEMO_CURRENT_IP, [...current.ipAllowlist, body.cidr])) {
        return error('self_lockout', DEMO_CURRENT_IP);
      }
      const after = authService.addIpRange(authz.orgId, body.cidr)!;
      record(request, 'Added IP allowlist range', { target: { label: body.cidr } });
      return HttpResponse.json<OrgSecurityResponse>(toResponse(after), { status: 200 });
    }),

    // Remove a CIDR range (AC-08). Emptying the allowlist re-opens access from all IPs.
    http.delete('*/api/org-security/ip-allowlist', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as RemoveIpRangeRequest;
      const current = authService.getOrgSecurity(authz.orgId)!;
      if (!current.ipAllowlist.includes(body.cidr)) return error('unknown_range', body.cidr);
      const after = authService.removeIpRange(authz.orgId, body.cidr)!;
      record(request, 'Removed IP allowlist range', { target: { label: body.cidr } });
      return HttpResponse.json<OrgSecurityResponse>(toResponse(after), { status: 200 });
    }),
  ];
}

export const orgSecurityHandlers = createOrgSecurityHandlers();
