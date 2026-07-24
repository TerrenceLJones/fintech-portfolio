import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  BudgetErrorResponse,
  BudgetHistoryResponse,
  BudgetOverviewResponse,
  Permission,
  SetBudgetRequest,
  SetBudgetResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { BudgetsService } from '../services/budgets.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedBudgetsService } from '../services/shared-budgets-service';
import { OnboardingTasksService } from '../services/onboarding-tasks.service';
import { sharedOnboardingTasksService } from '../services/shared-onboarding-tasks-service';
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
  const body: BudgetErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter in front of BudgetsService. Every endpoint is auth-gated and independently
 * re-checks `budget:view` server-side — the Controller-only route guard is never the security boundary,
 * so a downgraded or bypassed client still gets a 403 (US-CW-019).
 */
export function createBudgetsHandlers(
  service: BudgetsService = sharedBudgetsService,
  authService: AuthService = sharedAuthService,
  onboardingTasksService: OnboardingTasksService = sharedOnboardingTasksService,
): HttpHandler[] {
  /** Auth + server-side budget:view check, shared by every endpoint. */
  function authorize(request: Request) {
    const permissions = resolvePermissions(request, authService);
    if (!permissions) return { fail: unauthorizedForSession(request, authService) };
    if (!hasPermission(permissions, 'budget:view')) return { fail: forbidden() };
    return { fail: null };
  }

  return [
    http.get('*/api/budgets', ({ request }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      const body: BudgetOverviewResponse = service.getOverview();
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/budgets/:department/history', ({ request, params }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      const history = service.getHistory(String(params.department));
      if (!history) {
        const body: BudgetErrorResponse = { error: 'department_not_found' };
        return HttpResponse.json(body, { status: 404 });
      }
      const body: BudgetHistoryResponse = history;
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/budgets', async ({ request }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      const { department, amountMinorUnits, currency } = (await request.json()) as SetBudgetRequest;
      const outcome = service.setBudget(department, amountMinorUnits, currency);
      if (!outcome.ok) {
        const body: BudgetErrorResponse = { error: outcome.error };
        return HttpResponse.json(body, { status: outcome.error === 'invalid_amount' ? 422 : 404 });
      }
      // Creating a budget completes the "Set a budget" getting-started task (US-CW-047). The actor is
      // resolved from the session token, the same server-derived identity the audit trail uses.
      const actor = resolveAuditActor(request, authService);
      if (actor) onboardingTasksService.markComplete(actor.id, 'set-budget');
      const body: SetBudgetResponse = { budget: outcome.budget };
      return HttpResponse.json(body, { status: 201 });
    }),
  ];
}

export const budgetsHandlers = createBudgetsHandlers();
