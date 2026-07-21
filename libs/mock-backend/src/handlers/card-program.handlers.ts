import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  CardProgramDefaultsResponse,
  CardProgramErrorResponse,
  IssuancePolicyResponse,
  UpdateCardProgramDefaultsRequest,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { canRequestCard, validateCardProgramLimits } from '@clearline/domain-cards';
import {
  CARD_PROGRAM_CURRENCY,
  CARD_PROGRAM_MERCHANT_CATEGORIES,
} from '../fixtures/card-program.fixture';
import { AuditService } from '../services/audit.service';
import { AuthService, type StoredCardProgram } from '../services/auth.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

const ISSUANCE_LABEL: Record<StoredCardProgram['issuancePolicy'], string> = {
  everyone: 'Everyone',
  managers_and_above: 'Finance Managers and above',
};

/** A one-line summary of the card-program defaults for the audit diff (AC-10). */
function summarize(defaults: StoredCardProgram): string {
  return (
    `monthly ${defaults.defaultMonthlyLimitMinorUnits} · per-txn ${defaults.defaultPerTransactionLimitMinorUnits} · ` +
    `${defaults.defaultAllowedMccs.length || 'all'} MCCs · request: ${ISSUANCE_LABEL[defaults.issuancePolicy]}`
  );
}

const VALID_MCC_CODES = new Set(CARD_PROGRAM_MERCHANT_CATEGORIES.map((category) => category.code));

export function createCardProgramHandlers(
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** card-program:manage gate — Controller/Admin/Owner. Returns the caller's orgId, else a 401/403 status. */
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
    if (!hasPermission(permissions, 'card-program:manage')) return { ok: false, status: 403 };

    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { ok: false, status: 403 };
    return { ok: true, orgId };
  }

  function forbidden() {
    const body: CardProgramErrorResponse = { error: 'forbidden_role' };
    return HttpResponse.json(body, { status: 403 });
  }

  function toResponse(defaults: StoredCardProgram): CardProgramDefaultsResponse {
    return {
      defaultMonthlyLimit: {
        amountMinorUnits: defaults.defaultMonthlyLimitMinorUnits,
        currency: CARD_PROGRAM_CURRENCY,
      },
      defaultPerTransactionLimit: {
        amountMinorUnits: defaults.defaultPerTransactionLimitMinorUnits,
        currency: CARD_PROGRAM_CURRENCY,
      },
      defaultAllowedMccs: defaults.defaultAllowedMccs,
      issuancePolicy: defaults.issuancePolicy,
      merchantCategories: CARD_PROGRAM_MERCHANT_CATEGORIES.map((category) => ({ ...category })),
      currency: CARD_PROGRAM_CURRENCY,
    };
  }

  return [
    // Readable by ANY authenticated user — it gates the universal "Request a card" affordance, and the
    // server (never the client) decides whether the caller's role may request under the policy (AC-03).
    http.get('*/api/card-program/issuance-policy', ({ request }) => {
      const token = bearerToken(request);
      const session = token ? authService.checkSession(token) : null;
      if (!session || session.outcome !== 'active') {
        return unauthorizedForSession(request, authService);
      }
      const orgId = authService.getOrgIdForUser(session.userId!);
      const defaults = orgId ? authService.getCardProgramDefaults(orgId) : null;
      const issuancePolicy = defaults?.issuancePolicy ?? 'everyone';
      return HttpResponse.json<IssuancePolicyResponse>(
        { issuancePolicy, canRequest: canRequestCard(session.role!, issuancePolicy) },
        { status: 200 },
      );
    }),

    http.get('*/api/card-program', ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const defaults = authService.getCardProgramDefaults(authz.orgId)!;
      return HttpResponse.json<CardProgramDefaultsResponse>(toResponse(defaults), { status: 200 });
    }),

    http.patch('*/api/card-program', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401 ? unauthorizedForSession(request, authService) : forbidden();
      }
      const patch = (await request.json()) as UpdateCardProgramDefaultsRequest;

      // Server-authoritative coherence check so an incoherent default can never be persisted (AC-01).
      const validation = validateCardProgramLimits({
        defaultMonthlyLimitMinorUnits: patch.defaultMonthlyLimitMinorUnits,
        defaultPerTransactionLimitMinorUnits: patch.defaultPerTransactionLimitMinorUnits,
      });
      // Unknown MCC codes are rejected too — the client can only ever save codes from the catalogue.
      const mccsValid = patch.defaultAllowedMccs.every((code) => VALID_MCC_CODES.has(code));
      if (!validation.ok || !mccsValid) {
        const body: CardProgramErrorResponse = { error: 'invalid_limit' };
        return HttpResponse.json(body, { status: 422 });
      }

      const before = authService.getCardProgramDefaults(authz.orgId)!;
      const after = authService.setCardProgramDefaults(authz.orgId, {
        defaultMonthlyLimitMinorUnits: patch.defaultMonthlyLimitMinorUnits,
        defaultPerTransactionLimitMinorUnits: patch.defaultPerTransactionLimitMinorUnits,
        defaultAllowedMccs: patch.defaultAllowedMccs,
        issuancePolicy: patch.issuancePolicy,
      })!;

      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'card_program',
          action: 'Updated card program defaults',
          diff: { from: summarize(before), to: summarize(after) },
        });
      }
      return HttpResponse.json<CardProgramDefaultsResponse>(toResponse(after), { status: 200 });
    }),
  ];
}

export const cardProgramHandlers = createCardProgramHandlers();
