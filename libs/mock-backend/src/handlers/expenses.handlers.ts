import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  CreateExpenseRequest,
  ExpenseContextResponse,
  ExpenseErrorResponse,
  ExpenseResponse,
  MyExpensesResponse,
  SessionErrorResponse,
} from '@clearline/contracts';
import { permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { ExpensesService, type ExpenseActor } from '../services/expenses.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedExpensesService } from '../services/shared-expenses-service';

/**
 * Resolves the submitting user from the request's own access token — never from anything the client
 * claims. Permissions are derived server-side from the resolved role, so the endpoint is independently
 * authoritative regardless of what the UI rendered (US-CW-006). Returns null for no valid session.
 */
function resolveActor(request: Request, authService: AuthService): ExpenseActor | null {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) return null;

  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;

  return {
    userId: session.userId!,
    displayName: session.displayName!,
    permissions: permissionsForRole(session.role!, { isAdmin: session.isAdmin! }),
  };
}

const unauthorized = () => {
  const body: SessionErrorResponse = { error: 'invalid_token' };
  return HttpResponse.json(body, { status: 401 });
};

// Every role has `expenses:view`, so this is effectively unreachable — kept so the endpoint stays
// independently authoritative if the permission model ever narrows.
const forbidden = () => HttpResponse.json({ error: 'forbidden' }, { status: 403 });

/** Thin HTTP adapter in front of ExpensesService — the policy rules live in the service/domain, not here. */
export function createExpensesHandlers(
  expensesService: ExpensesService = sharedExpensesService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  return [
    http.get('*/api/expenses/context', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = expensesService.getContext(actor);
      if (result.outcome === 'forbidden') return forbidden();
      const body: ExpenseContextResponse = {
        categories: result.categories,
        receiptRequiredThresholdMinorUnits: result.receiptRequiredThresholdMinorUnits,
        currency: result.currency,
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/expenses', ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const result = expensesService.listMine(actor);
      if (result.outcome === 'forbidden') return forbidden();
      const body: MyExpensesResponse = { expenses: result.expenses };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/expenses', async ({ request }) => {
      const actor = resolveActor(request, authService);
      if (!actor) return unauthorized();

      const payload = (await request.json()) as CreateExpenseRequest;
      const result = expensesService.submit(payload, actor);
      if (result.outcome === 'forbidden') return forbidden();
      if (result.outcome === 'validation_error') {
        const body: ExpenseErrorResponse = { error: result.reason };
        return HttpResponse.json(body, { status: 422 });
      }
      const body: ExpenseResponse = { expense: result.expense };
      return HttpResponse.json(body, { status: 201 });
    }),
  ];
}

export const expensesHandlers = createExpensesHandlers();
