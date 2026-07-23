import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ApiKeyScope,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateWebhookRequest,
  CreateWebhookResponse,
  DeveloperErrorResponse,
  DeveloperResponse,
  VerifyApiKeyRequest,
  VerifyApiKeyResponse,
  WebhookEventType,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import {
  API_KEY_SCOPES,
  WEBHOOK_EVENT_TYPES,
  isHttpsWebhookUrl,
} from '@clearline/domain-developer';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { DeveloperService } from '../services/developer.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedDeveloperService } from '../services/shared-developer-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

const VALID_SCOPES = new Set<ApiKeyScope>(API_KEY_SCOPES.map((s) => s.scope));
const VALID_EVENTS = new Set<WebhookEventType>(WEBHOOK_EVENT_TYPES.map((e) => e.event));

export function createDeveloperHandlers(
  service: DeveloperService = sharedDeveloperService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** developer:manage gate — Admin/Owner only. Returns the caller's orgId, else a 401/403 status. */
  function authorize(
    request: Request,
  ): { ok: true; orgId: string } | { ok: false; status: 401 | 403 } {
    const token = bearerToken(request);
    const session = token ? authService.checkSession(token) : null;
    if (!session || session.outcome !== 'active') return { ok: false, status: 401 };

    const permissions = permissionsForRole(session.role!, {
      isAdmin: session.isAdmin!,
      isOwner: session.isOwner!,
    });
    if (!hasPermission(permissions, 'developer:manage')) return { ok: false, status: 403 };

    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { ok: false, status: 403 };
    return { ok: true, orgId };
  }

  function forbidden() {
    return HttpResponse.json<DeveloperErrorResponse>({ error: 'forbidden_role' }, { status: 403 });
  }

  function error(code: DeveloperErrorResponse['error'], status: number, detail?: string) {
    const body: DeveloperErrorResponse = detail ? { error: code, detail } : { error: code };
    return HttpResponse.json(body, { status });
  }

  function record(request: Request, action: string, label: string) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({ actor, category: 'developer', action, target: { label } });
  }

  return [
    http.get('*/api/developer', ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      return HttpResponse.json<DeveloperResponse>(service.snapshot(authz.orgId), { status: 200 });
    }),

    // Create a scoped API key (AC-01). The plaintext is in the 201 body once, never re-served (AC-02).
    http.post('*/api/developer/api-keys', async ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as CreateApiKeyRequest;
      const name = body.name?.trim() ?? '';
      if (!name) return error('invalid_name', 422);
      if (!Array.isArray(body.scopes) || body.scopes.length === 0) return error('no_scopes', 422);
      const badScope = body.scopes.find((s) => !VALID_SCOPES.has(s));
      if (badScope) return error('invalid_scope', 422, badScope);

      const result = service.createApiKey(authz.orgId, name, body.scopes);
      record(request, 'Created API key', name);
      return HttpResponse.json<CreateApiKeyResponse>(result, { status: 201 });
    }),

    // Verify a presented key against a required scope (AC-03/04). Never a generic auth error: a scope
    // shortfall names the missing scope (403); a revoked/unknown key is 401.
    http.post('*/api/developer/api-keys/verify', async ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as VerifyApiKeyRequest;
      const result = service.verifyApiKey(authz.orgId, body.key ?? '', body.requiredScope);
      if (result.outcome === 'invalid_key') return error('invalid_key', 401);
      if (result.outcome === 'insufficient_scope') {
        return error('insufficient_scope', 403, result.missingScope);
      }
      return HttpResponse.json<VerifyApiKeyResponse>({ ok: true }, { status: 200 });
    }),

    // Revoke a key immediately and permanently (AC-04).
    http.delete('*/api/developer/api-keys/:id', ({ request, params }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const keyId = String(params.id);
      // Resolve the name before revoking, and from the full store (not the active snapshot) so a
      // concurrent/repeat revoke still audits the name rather than the raw id.
      const name = service.apiKeyName(authz.orgId, keyId);
      const result = service.revokeApiKey(authz.orgId, keyId);
      if (result.outcome === 'not_found') return error('unknown_key', 404);
      record(request, 'Revoked API key', name ?? keyId);
      return HttpResponse.json<DeveloperResponse>(service.snapshot(authz.orgId), { status: 200 });
    }),

    // Register an HTTPS webhook endpoint (AC-06). Non-HTTPS is refused server-side too (AC-07).
    http.post('*/api/developer/webhooks', async ({ request }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const body = (await request.json()) as CreateWebhookRequest;
      const url = body.url?.trim() ?? '';
      if (!isHttpsWebhookUrl(url)) return error('invalid_url', 422, url);
      if (!Array.isArray(body.events) || body.events.length === 0) return error('no_events', 422);
      const badEvent = body.events.find((e) => !VALID_EVENTS.has(e));
      if (badEvent) return error('invalid_event', 422, badEvent);

      const result = service.createWebhook(authz.orgId, url, body.events);
      record(request, 'Created webhook', url);
      return HttpResponse.json<CreateWebhookResponse>(result, { status: 201 });
    }),

    // Delete a webhook endpoint (AC-06).
    http.delete('*/api/developer/webhooks/:id', ({ request, params }) => {
      const authz = authorize(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const webhookId = String(params.id);
      const webhook = service.snapshot(authz.orgId).webhooks.find((w) => w.id === webhookId);
      const result = service.deleteWebhook(authz.orgId, webhookId);
      if (result.outcome === 'not_found') return error('unknown_webhook', 404);
      record(request, 'Deleted webhook', webhook?.url ?? webhookId);
      return HttpResponse.json<DeveloperResponse>(service.snapshot(authz.orgId), { status: 200 });
    }),

    // Re-send a failed delivery (AC-09). A new log entry is appended; the original is untouched.
    http.post(
      '*/api/developer/webhooks/:id/deliveries/:deliveryId/resend',
      ({ request, params }) => {
        const authz = authorize(request);
        if (!authz.ok) {
          return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
        }
        const webhookId = String(params.id);
        const result = service.resendDelivery(authz.orgId, webhookId, String(params.deliveryId));
        if (result.outcome === 'not_found') return error('unknown_delivery', 404);
        record(request, 'Resent webhook delivery', result.webhook.url);
        return HttpResponse.json<DeveloperResponse>(service.snapshot(authz.orgId), { status: 200 });
      },
    ),
  ];
}

export const developerHandlers = createDeveloperHandlers();
