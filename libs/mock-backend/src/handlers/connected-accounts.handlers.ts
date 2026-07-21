import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ConnectManuallyRequest,
  ConnectedAccount,
  ConnectedAccountErrorCode,
  ConnectedAccountErrorResponse,
  ConnectedAccountResponse,
  ConnectedAccountsResponse,
  VerifyMicroDepositsRequest,
  VerifyMicroDepositsResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { ConnectedAccountsService } from '../services/connected-accounts.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedConnectedAccountsService } from '../services/shared-connected-accounts-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

function error(code: ConnectedAccountErrorCode, status: number) {
  const body: ConnectedAccountErrorResponse = { error: code };
  return HttpResponse.json(body, { status });
}

/**
 * Thin HTTP adapter in front of ConnectedAccountsService (US-CW-038). Every endpoint independently
 * re-checks `bank-accounts:manage` server-side (the route guard is never the boundary), resolves the
 * caller's own orgId, and scopes every service call to it — so one org can never read or mutate
 * another's accounts (a cross-org target is indistinguishable from a missing one). Every mutation
 * records a `connected_account` audit event with the masked account — never the account number (AC-10).
 */
export function createConnectedAccountsHandlers(
  service: ConnectedAccountsService = sharedConnectedAccountsService,
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** Auth + server-side bank-accounts:manage check, resolving the caller's owning org. */
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
    if (!hasPermission(permissions, 'bank-accounts:manage')) {
      return { fail: error('forbidden_role', 403) };
    }
    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { fail: error('forbidden_role', 403) };
    return { fail: null, orgId };
  }

  function audit(request: Request, action: string, account: ConnectedAccount) {
    const actor = resolveAuditActor(request, authService);
    if (!actor) return;
    auditService.record({
      actor,
      category: 'connected_account',
      action,
      target: { label: `${account.institutionName} ••••${account.last4}` },
    });
  }

  return [
    http.get('*/api/connected-accounts', ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      return HttpResponse.json<ConnectedAccountsResponse>(
        { accounts: service.list(authz.orgId) },
        { status: 200 },
      );
    }),

    http.post('*/api/connected-accounts/plaid', ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const account = service.connectViaPlaid(authz.orgId);
      audit(request, 'Connected bank account via Plaid', account);
      return HttpResponse.json<ConnectedAccountResponse>({ account }, { status: 201 });
    }),

    http.post('*/api/connected-accounts/manual', async ({ request }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const body = (await request.json()) as ConnectManuallyRequest;
      const result = service.connectManually(authz.orgId, body.routingNumber, body.accountNumber);
      switch (result.outcome) {
        case 'invalid_routing':
          return error('invalid_routing', 422);
        case 'invalid_account':
          return error('invalid_account', 422);
        case 'already_connected':
          return error('already_connected', 409);
        case 'ok':
          audit(request, 'Connected bank account manually', result.account);
          return HttpResponse.json<ConnectedAccountResponse>(
            { account: result.account },
            { status: 201 },
          );
      }
    }),

    http.post('*/api/connected-accounts/:id/verify', async ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const body = (await request.json()) as VerifyMicroDepositsRequest;
      const result = service.verifyMicroDeposits(
        authz.orgId,
        String(params.id),
        body.amountsMinorUnits,
      );
      if (result.outcome === 'not_found') return error('account_not_found', 404);
      if (result.outcome === 'not_pending') return error('not_pending', 409);
      if (result.outcome === 'verified') {
        audit(request, 'Verified bank account', result.account);
      }
      return HttpResponse.json<VerifyMicroDepositsResponse>(
        {
          account: result.account,
          outcome: result.outcome,
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 200 },
      );
    }),

    http.post('*/api/connected-accounts/:id/reconnect', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const result = service.reconnect(authz.orgId, String(params.id));
      if (result.outcome === 'not_found') return error('account_not_found', 404);
      audit(request, 'Reconnected bank account', result.account);
      return HttpResponse.json<ConnectedAccountResponse>(
        { account: result.account },
        { status: 200 },
      );
    }),

    http.delete('*/api/connected-accounts/:id', ({ request, params }) => {
      const authz = authorize(request);
      if (authz.fail) return authz.fail;
      const result = service.remove(authz.orgId, String(params.id));
      if (result.outcome === 'not_found') return error('account_not_found', 404);
      audit(request, 'Removed bank account', result.account);
      return HttpResponse.json<ConnectedAccountResponse>(
        { account: result.account },
        { status: 200 },
      );
    }),
  ];
}

export const connectedAccountsHandlers = createConnectedAccountsHandlers();
