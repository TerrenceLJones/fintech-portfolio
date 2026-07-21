import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  GlMappingResponse,
  Integration,
  IntegrationErrorCode,
  IntegrationErrorResponse,
  IntegrationProvider,
  IntegrationResponse,
  IntegrationsResponse,
  SyncLogResponse,
  SyncResult,
  UpdateGlMappingRequest,
} from '@clearline/contracts';
import {
  integrationProviderName,
  isIntegrationProvider,
  unmappedCategoryCount,
} from '@clearline/domain-integrations';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { IntegrationsService } from '../services/integrations.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedIntegrationsService } from '../services/shared-integrations-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

function error(code: IntegrationErrorCode, status: number) {
  const body: IntegrationErrorResponse = { error: code };
  return HttpResponse.json(body, { status });
}

/**
 * Thin HTTP adapter in front of IntegrationsService (US-CW-039). Every endpoint independently re-checks
 * `integrations:manage` server-side (the route guard is never the boundary), resolves the caller's own
 * orgId, and scopes every service call to it — so one org can never read or mutate another's
 * integrations. Every mutation records an `accounting_integration` audit event (AC-10): connect/sync/
 * reconnect/disconnect as a target event, and a GL-mapping change as a before → after diff.
 */
export function createIntegrationsHandlers(
  service: IntegrationsService = sharedIntegrationsService,
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

  /** Resolve the :provider path param to a known provider, or a 404 response. */
  function provider(
    value: string | readonly string[] | undefined,
  ): { provider: IntegrationProvider } | { fail: Response } {
    const raw = String(value);
    if (!isIntegrationProvider(raw)) return { fail: error('unknown_provider', 404) };
    return { provider: raw };
  }

  function auditTarget(request: Request, action: string, integration: Integration) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({
      actor,
      category: 'accounting_integration',
      action,
      target: { label: integration.name },
    });
  }

  return [
    http.get('*/api/integrations', ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      return HttpResponse.json<IntegrationsResponse>(
        { integrations: service.list(authz.orgId) },
        { status: 200 },
      );
    }),

    http.post('*/api/integrations/:provider/connect', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const result = service.connect(authz.orgId, resolved.provider);
      if (result.outcome === 'already_connected') return error('already_connected', 409);
      auditTarget(
        request,
        `Connected ${integrationProviderName(resolved.provider)}`,
        result.integration,
      );
      return HttpResponse.json<IntegrationResponse>(
        { integration: result.integration },
        { status: 201 },
      );
    }),

    http.get('*/api/integrations/:provider/gl-mapping', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const mapping = service.getGlMapping(authz.orgId, resolved.provider);
      return HttpResponse.json<GlMappingResponse>(mapping, { status: 200 });
    }),

    http.put('*/api/integrations/:provider/gl-mapping', async ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const before = service.getGlMapping(authz.orgId, resolved.provider).mappings;
      const body = (await request.json()) as UpdateGlMappingRequest;
      const result = service.updateGlMapping(authz.orgId, resolved.provider, body.mappings);
      if (result.outcome === 'not_connected') return error('not_connected', 409);
      const after = service.getGlMapping(authz.orgId, resolved.provider).mappings;
      const actor = resolveAuditActor(request, authService);
      if (actor) {
        const total = after.length;
        auditService.record({
          actor,
          category: 'accounting_integration',
          action: `Updated ${integrationProviderName(resolved.provider)} GL mapping`,
          diff: {
            from: `${total - unmappedCategoryCount(before)}/${total} categories mapped`,
            to: `${total - unmappedCategoryCount(after)}/${total} categories mapped`,
          },
        });
      }
      return HttpResponse.json<IntegrationResponse>(
        { integration: result.integration },
        { status: 200 },
      );
    }),

    http.post('*/api/integrations/:provider/sync', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const result = service.syncNow(authz.orgId, resolved.provider);
      if (result.outcome === 'not_connected') return error('not_connected', 409);
      auditTarget(
        request,
        `Synced ${integrationProviderName(resolved.provider)} (${result.result.recordsSynced} records, ${result.result.outcome})`,
        result.result.integration,
      );
      return HttpResponse.json<SyncResult>(result.result, { status: 200 });
    }),

    http.get('*/api/integrations/:provider/sync-log', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      return HttpResponse.json<SyncLogResponse>(
        { entries: service.getSyncLog(authz.orgId, resolved.provider) },
        { status: 200 },
      );
    }),

    http.post('*/api/integrations/:provider/reconnect', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const result = service.reconnect(authz.orgId, resolved.provider);
      if (result.outcome === 'not_connected') return error('not_connected', 409);
      auditTarget(
        request,
        `Reconnected ${integrationProviderName(resolved.provider)}`,
        result.integration,
      );
      return HttpResponse.json<IntegrationResponse>(
        { integration: result.integration },
        { status: 200 },
      );
    }),

    http.post('*/api/integrations/:provider/disconnect', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const resolved = provider(params.provider);
      if ('fail' in resolved) return resolved.fail;
      const result = service.disconnect(authz.orgId, resolved.provider);
      if (result.outcome === 'not_connected') return error('not_connected', 409);
      auditTarget(
        request,
        `Disconnected ${integrationProviderName(resolved.provider)}`,
        result.integration,
      );
      return HttpResponse.json<IntegrationResponse>(
        { integration: result.integration },
        { status: 200 },
      );
    }),
  ];
}

export const integrationsHandlers = createIntegrationsHandlers();
