import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AddRecipientRequest,
  OrgNotificationErrorCode,
  OrgNotificationErrorResponse,
  OrgNotificationSettingsResponse,
  RecipientCandidatesResponse,
  SetReminderFrequencyRequest,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { OrgNotificationsService } from '../services/org-notifications.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedOrgNotificationsService } from '../services/shared-org-notifications-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

function error(code: OrgNotificationErrorCode, status: number) {
  const body: OrgNotificationErrorResponse = { error: code };
  return HttpResponse.json(body, { status });
}

const FREQUENCY_LABEL: Record<string, string> = {
  off: 'Off',
  every_24_hours: 'Every 24 hours',
  every_72_hours: 'Every 72 hours',
};

/**
 * Thin HTTP adapter in front of OrgNotificationsService (US-CW-039). Every endpoint independently
 * re-checks `integrations:manage` server-side, resolves the caller's own orgId, and scopes every
 * service call to it. Each mutation records an `org_notification` audit event (AC-10) — recipient
 * add/remove as a target event, a cadence change as a before → after diff.
 */
export function createOrgNotificationsHandlers(
  service: OrgNotificationsService = sharedOrgNotificationsService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  function authorize(request: Request): { fail: Response } | { fail: null; orgId: string } {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    if (!session || session.outcome !== 'active') {
      return { fail: unauthorizedForSession(request, authService) };
    }
    const permissions = permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    });
    if (!hasPermission(permissions, 'integrations:manage')) {
      return { fail: error('forbidden_role', 403) };
    }
    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { fail: error('forbidden_role', 403) };
    return { fail: null, orgId };
  }

  return [
    http.get('*/api/org-notifications', ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      return HttpResponse.json<OrgNotificationSettingsResponse>(
        { settings: service.getSettings(authz.orgId) },
        { status: 200 },
      );
    }),

    http.get('*/api/org-notifications/candidates', ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      return HttpResponse.json<RecipientCandidatesResponse>(
        { candidates: service.listCandidates(authz.orgId) },
        { status: 200 },
      );
    }),

    http.post('*/api/org-notifications/budget-alert-recipients', async ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const body = (await request.json()) as AddRecipientRequest;
      const result = service.addRecipient(authz.orgId, body.recipientId);
      if (result.outcome === 'unknown_recipient') return error('unknown_recipient', 404);
      if (result.outcome === 'already_recipient') return error('already_recipient', 409);
      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'org_notification',
          action: 'Added budget-alert recipient',
          target: { label: result.recipient.name },
        });
      }
      return HttpResponse.json<OrgNotificationSettingsResponse>(
        { settings: service.getSettings(authz.orgId) },
        { status: 201 },
      );
    }),

    http.delete('*/api/org-notifications/budget-alert-recipients/:id', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const result = service.removeRecipient(authz.orgId, String(params.id));
      if (result.outcome === 'unknown_recipient') return error('unknown_recipient', 404);
      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'org_notification',
          action: 'Removed budget-alert recipient',
          target: { label: result.recipient.name },
        });
      }
      return HttpResponse.json<OrgNotificationSettingsResponse>(
        { settings: service.getSettings(authz.orgId) },
        { status: 200 },
      );
    }),

    http.put('*/api/org-notifications/approval-reminder', async ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const before = service.getSettings(authz.orgId).approvalReminderFrequency;
      const body = (await request.json()) as SetReminderFrequencyRequest;
      const result = service.setReminderFrequency(authz.orgId, body.frequency);
      if (result.outcome === 'invalid_frequency') return error('invalid_frequency', 422);
      const actor = resolveAuditActor(request, authService);
      if (actor && before !== body.frequency) {
        auditService.record({
          actor,
          category: 'org_notification',
          action: 'Changed approval-queue reminder frequency',
          diff: {
            from: FREQUENCY_LABEL[before] ?? before,
            to: FREQUENCY_LABEL[body.frequency] ?? body.frequency,
          },
        });
      }
      return HttpResponse.json<OrgNotificationSettingsResponse>(
        { settings: service.getSettings(authz.orgId) },
        { status: 200 },
      );
    }),
  ];
}

export const orgNotificationsHandlers = createOrgNotificationsHandlers();
