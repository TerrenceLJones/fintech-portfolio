import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  ApprovalPolicyErrorResponse,
  ApprovalPolicyResponse,
  ApprovalPolicyTier,
  CategorySpendCap,
  SpendControlsErrorResponse,
  SpendControlsResponse,
  UpdateApprovalPolicyRequest,
  UpdateSpendControlsRequest,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import {
  formatTierIssue,
  formatTierRange,
  validateApprovalTiers,
} from '@clearline/domain-expenses';
import { EXPENSE_CURRENCY, SEED_EXPENSE_CATEGORIES } from '../fixtures/expenses.fixture';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { sharedAuditService } from '../services/shared-audit-service';
import { sharedAuthService } from '../services/shared-auth-service';
import { resolveAuditActor } from './audit-actor';
import { bearerToken, unauthorizedForSession } from './session-auth';

const APPROVER_LABEL: Record<ApprovalPolicyTier['approver'], string> = {
  auto: 'Auto-approve',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/** A one-line summary of the tier ladder for the audit diff (AC-10). */
function summarizeTiers(tiers: ApprovalPolicyTier[]): string {
  return tiers
    .map((tier) => `${formatTierRange(tier, EXPENSE_CURRENCY)} ${APPROVER_LABEL[tier.approver]}`)
    .join('; ');
}

/** A one-line summary of the spend controls for the audit diff (AC-10). */
function summarizeControls(controls: {
  receiptRequiredThresholdMinorUnits: number;
  memoRequiredThresholdMinorUnits: number;
  outOfPolicyBehavior: string;
  categoryCaps: Record<string, number | null>;
}): string {
  const capped = Object.entries(controls.categoryCaps).filter(([, limit]) => limit != null).length;
  return (
    `receipt>${controls.receiptRequiredThresholdMinorUnits} · memo>${controls.memoRequiredThresholdMinorUnits} · ` +
    `${controls.outOfPolicyBehavior} · ${capped} capped categories`
  );
}

export function createPoliciesHandlers(
  authService: AuthService = sharedAuthService,
  auditService: AuditService = sharedAuditService,
): HttpHandler[] {
  /** policies:manage gate — Controller/Admin/Owner. Returns the caller's orgId, else a 401/403 status. */
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
    if (!hasPermission(permissions, 'policies:manage')) return { ok: false, status: 403 };

    const orgId = authService.getOrgIdForUser(session.userId!);
    if (!orgId) return { ok: false, status: 403 };
    return { ok: true, orgId };
  }

  function approvalForbidden() {
    const body: ApprovalPolicyErrorResponse = { error: 'forbidden_role' };
    return HttpResponse.json(body, { status: 403 });
  }
  function controlsForbidden() {
    const body: SpendControlsErrorResponse = { error: 'forbidden_role' };
    return HttpResponse.json(body, { status: 403 });
  }

  /** Builds the spend-controls view, joining the org's stored caps with the category catalogue. */
  function spendControlsResponse(orgId: string): SpendControlsResponse {
    const stored = authService.getSpendControls(orgId)!;
    const categoryCaps: CategorySpendCap[] = SEED_EXPENSE_CATEGORIES.map((category) => ({
      categoryId: category.id,
      label: category.label,
      monthlyLimitMinorUnits: stored.categoryCaps[category.id] ?? null,
    }));
    return {
      receiptRequiredThresholdMinorUnits: stored.receiptRequiredThresholdMinorUnits,
      memoRequiredThresholdMinorUnits: stored.memoRequiredThresholdMinorUnits,
      outOfPolicyBehavior: stored.outOfPolicyBehavior,
      categoryCaps,
      currency: EXPENSE_CURRENCY,
    };
  }

  return [
    http.get('*/api/approval-policy', ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401
          ? unauthorizedForSession(request, authService)
          : approvalForbidden();
      }
      const tiers = authService.getApprovalTiers(authz.orgId)!;
      return HttpResponse.json<ApprovalPolicyResponse>(
        { tiers, currency: EXPENSE_CURRENCY },
        { status: 200 },
      );
    }),

    http.patch('*/api/approval-policy', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401
          ? unauthorizedForSession(request, authService)
          : approvalForbidden();
      }
      const patch = (await request.json()) as UpdateApprovalPolicyRequest;

      // Server-authoritative coherence check: reject a gap/overlap/inverted policy so an administrator
      // can never persist tiers that would strand an expense (AC-03/AC-04/AC-10), independent of the UI.
      const validation = validateApprovalTiers(
        patch.tiers.map((tier, index) => ({ id: `t_${index}`, ...tier })),
      );
      if (!validation.ok) {
        const body: ApprovalPolicyErrorResponse = {
          error: 'incoherent_policy',
          issues: validation.issues.map((issue) => formatTierIssue(issue, EXPENSE_CURRENCY)),
        };
        return HttpResponse.json(body, { status: 422 });
      }

      const before = authService.getApprovalTiers(authz.orgId)!;
      const after = authService.setApprovalTiers(authz.orgId, patch.tiers)!;

      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'approval_policy',
          action: 'Updated approval policy',
          diff: { from: summarizeTiers(before), to: summarizeTiers(after) },
        });
      }
      return HttpResponse.json<ApprovalPolicyResponse>(
        { tiers: after, currency: EXPENSE_CURRENCY },
        { status: 200 },
      );
    }),

    http.get('*/api/spend-controls', ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401
          ? unauthorizedForSession(request, authService)
          : controlsForbidden();
      }
      return HttpResponse.json<SpendControlsResponse>(spendControlsResponse(authz.orgId), {
        status: 200,
      });
    }),

    http.patch('*/api/spend-controls', async ({ request }) => {
      const authz = authorizeOrg(request);
      if (!authz.ok) {
        return authz.status === 401
          ? unauthorizedForSession(request, authService)
          : controlsForbidden();
      }
      const patch = (await request.json()) as UpdateSpendControlsRequest;

      // Thresholds and caps are non-negative integer minor units; a malformed value is rejected (AC-06).
      const nonNegativeInt = (value: number) => Number.isInteger(value) && value >= 0;
      const validThresholds =
        nonNegativeInt(patch.receiptRequiredThresholdMinorUnits) &&
        nonNegativeInt(patch.memoRequiredThresholdMinorUnits) &&
        patch.categoryCaps.every(
          (cap) =>
            cap.monthlyLimitMinorUnits === null || nonNegativeInt(cap.monthlyLimitMinorUnits),
        );
      if (!validThresholds) {
        const body: SpendControlsErrorResponse = { error: 'invalid_threshold' };
        return HttpResponse.json(body, { status: 422 });
      }

      const categoryCaps: Record<string, number | null> = {};
      for (const cap of patch.categoryCaps) {
        categoryCaps[cap.categoryId] = cap.monthlyLimitMinorUnits;
      }

      const before = authService.getSpendControls(authz.orgId)!;
      const after = authService.setSpendControls(authz.orgId, {
        receiptRequiredThresholdMinorUnits: patch.receiptRequiredThresholdMinorUnits,
        memoRequiredThresholdMinorUnits: patch.memoRequiredThresholdMinorUnits,
        outOfPolicyBehavior: patch.outOfPolicyBehavior,
        categoryCaps,
      })!;

      const actor = resolveAuditActor(request, authService);
      if (actor) {
        auditService.record({
          actor,
          category: 'spend_control',
          action: 'Updated spend controls',
          diff: { from: summarizeControls(before), to: summarizeControls(after) },
        });
      }
      return HttpResponse.json<SpendControlsResponse>(spendControlsResponse(authz.orgId), {
        status: 200,
      });
    }),
  ];
}

export const policiesHandlers = createPoliciesHandlers();
