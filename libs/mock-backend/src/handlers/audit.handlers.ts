import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AuditErrorResponse, AuditLogResponse, Permission } from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedAuditService } from '../services/shared-audit-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

/** Resolve the caller's server-derived permissions from their own access token — never client claims. */
function resolvePermissions(
  request: Request,
  authService: AuthService,
): readonly Permission[] | null {
  const accessToken = bearerToken(request);
  if (!accessToken) return null;
  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;
  return permissionsForRole(session.role!, {
    isAdmin: session.isAdmin!,
    isOwner: session.isOwner!,
  });
}

function forbidden() {
  const body: AuditErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter in front of the append-only AuditService (US-CW-021). The single read endpoint is
 * authorization-gated to `audit:view` and re-checks it server-side (the route guard is never the
 * security boundary) — a non-Controller is denied outright with a 403, never shown a limited view
 * (AC-06). Reading the log is itself an auditable action: on a successful read the caller's access is
 * recorded as a new `audit_access` event, so it appears at the top of the very list returned. There
 * is deliberately no write/update/delete endpoint here — the log is append-only (AC-05), and the only
 * appends come from the mutating financial flows (payments, approvals, cards) and this self-audit.
 */
export function createAuditHandlers(
  service: AuditService = sharedAuditService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/audit-log', ({ request }) => {
      const permissions = resolvePermissions(request, authService);
      if (!permissions) return unauthorizedForSession(request, authService);
      if (!hasPermission(permissions, 'audit:view')) return forbidden();

      // Viewing the audit log is itself an auditable action (AC-06). Record it before reading so the
      // access event is included in — and tops — the list the viewer gets back.
      const actor = resolveAuditActor(request, authService);
      if (actor) {
        service.record({ actor, category: 'audit_access', action: 'Viewed audit log' });
      }

      const body: AuditLogResponse = { events: service.list() };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const auditHandlers = createAuditHandlers();
