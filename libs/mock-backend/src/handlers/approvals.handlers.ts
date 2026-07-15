import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ApprovalActionResponse,
  ApprovalErrorResponse,
  ApprovalQueueResponse,
  RejectApprovalRequest,
  SessionErrorResponse,
} from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { ApprovalsService, type ApprovalActor } from '../services/approvals.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedApprovalsService } from '../services/shared-approvals-service';

/**
 * Resolves the acting approver from the request's own access token — never from anything the client
 * claims about itself. checkSession re-reads the live user record, so a role changed mid-session is
 * reflected here on the very next call (US-CW-006 AC-05). Returns null when there's no valid session,
 * which the handlers turn into a 401. Permissions are derived server-side from the resolved role, so
 * the endpoint is independently authoritative regardless of what the UI rendered.
 */
function resolveActor(request: Request, authService: AuthService): ApprovalActor | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;

  return {
    userId: session.userId!,
    displayName: session.displayName!,
    permissions: permissionsForRole(session.role!, { isAdmin: session.isAdmin! }),
    approvalLimit: session.approvalLimit ?? null,
  };
}

const unauthorized = () => {
  const body: SessionErrorResponse = { error: 'invalid_token' };
  return HttpResponse.json(body, { status: 401 });
};

/** Thin HTTP adapter in front of ApprovalsService — the authorization rules live in the service/domain, not here. */
export function createApprovalsHandlers(
  approvalsService: ApprovalsService = sharedApprovalsService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/approvals', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = approvalsService.getQueue(actor);
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: 'forbidden_role' };
        return HttpResponse.json(body, { status: 403 });
      }
      const body: ApprovalQueueResponse = { items: result.items };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/approve', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = approvalsService.approve(String(params.id), actor);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'conflict') {
        const body: ApprovalErrorResponse = { error: 'stale_action', actedBy: result.actedBy };
        return HttpResponse.json(body, { status: 409 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = {
          error: result.reason,
          ...(result.approvalLimit !== undefined ? { approvalLimit: result.approvalLimit } : {}),
        };
        return HttpResponse.json(body, { status: 403 });
      }
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/reject', async ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const { reason } = (await request.json()) as RejectApprovalRequest;
      const result = approvalsService.reject(String(params.id), actor, reason);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'conflict') {
        const body: ApprovalErrorResponse = { error: 'stale_action', actedBy: result.actedBy };
        return HttpResponse.json(body, { status: 409 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 403 });
      }
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/escalate', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = approvalsService.escalate(String(params.id), actor);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 403 });
      }
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/reassign', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = approvalsService.reassign(String(params.id), actor);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 403 });
      }
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const approvalsHandlers = createApprovalsHandlers();
