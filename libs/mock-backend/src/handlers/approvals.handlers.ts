import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ApprovalActionResponse,
  ApprovalErrorResponse,
  ApprovalQueueResponse,
  RejectApprovalRequest,
} from '@clearline/contracts';
import type { ApprovalQueueItem } from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { ApprovalsService, type ApprovalActor } from '../services/approvals.service';
import { AuditService } from '../services/audit.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedApprovalsService } from '../services/shared-approvals-service';
import { sharedAuditService } from '../services/shared-audit-service';
import { formatAuditMoney, resolveAuditActor } from './audit-actor';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { sharedOnboardingTasksService } from '../services/shared-onboarding-tasks-service';
import { bearerToken, unauthorizedForSession } from './session-auth';

/**
 * Resolves the acting approver from the request's own access token — never from anything the client
 * claims about itself. checkSession re-reads the live user record, so a role changed mid-session is
 * reflected here on the very next call (US-CW-006 AC-05). Returns null when there's no active session,
 * which the handlers turn into a 401 via unauthorizedForSession (expired → recoverable, US-CW-002
 * AC-01). Permissions are derived server-side from the resolved role, so the endpoint is
 * independently authoritative regardless of what the UI rendered.
 */
function resolveActor(request: Request, authService: AuthService): ApprovalActor | null {
  const accessToken = bearerToken(request);
  if (!accessToken) return null;

  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;

  return {
    userId: session.userId!,
    displayName: session.displayName!,
    permissions: permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    }),
    approvalLimit: session.approvalLimit ?? null,
  };
}

/** Thin HTTP adapter in front of ApprovalsService — the authorization rules live in the service/domain, not here. */
export function createApprovalsHandlers(
  approvalsService: ApprovalsService = sharedApprovalsService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
  onboardingTasksService: OnboardingTasksService = sharedOnboardingTasksService,
): HttpHandler[] {
  /**
   * Record an approval decision in the central audit log (US-CW-021 AC-02): who took the action, what
   * action, on which expense, and when. The actor is re-resolved from the session so the event carries
   * their role. A `reason` (rejection) is appended to the detail line when present.
   */
  function recordDecision(
    request: Request,
    item: ApprovalQueueItem,
    action: string,
    reason?: string,
  ) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({
      actor,
      category: 'approval',
      action,
      target: { label: `${item.category} · ${item.submitterName}`, ref: item.id },
      detail: `${formatAuditMoney(item.amount)}${reason ? ` · ${reason}` : ''}`,
    });
  }

  return [
    http.get('*/api/approvals', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

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
      if (!actor) return unauthorizedForSession(request, authService);

      const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
      const result = approvalsService.approve(String(params.id), actor, idempotencyKey);
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
      recordDecision(request, result.item, 'Approved expense');
      // Actioning an approval clears the Finance Manager's signature getting-started task (US-CW-047).
      onboardingTasksService.markComplete(actor.userId, 'clear-approval');
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/reject', async ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

      const { reason } = (await request.json()) as RejectApprovalRequest;
      const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
      const result = approvalsService.reject(String(params.id), actor, reason, idempotencyKey);
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
      recordDecision(request, result.item, 'Rejected expense', reason);
      // Rejecting also actions (clears) an approval — the signature task is "make the call", not "approve".
      onboardingTasksService.markComplete(actor.userId, 'clear-approval');
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/escalate', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

      const result = approvalsService.escalate(String(params.id), actor);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 403 });
      }
      recordDecision(request, result.item, 'Escalated expense');
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/approvals/:id/reassign', ({ request, params }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorizedForSession(request, authService);

      const result = approvalsService.reassign(String(params.id), actor);
      if (result.outcome === 'not_found') {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }
      if (result.outcome === 'forbidden') {
        const body: ApprovalErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 403 });
      }
      recordDecision(request, result.item, 'Reassigned approver');
      const body: ApprovalActionResponse = { item: result.item };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const approvalsHandlers = createApprovalsHandlers();
