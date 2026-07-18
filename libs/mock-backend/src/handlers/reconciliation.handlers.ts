import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  Permission,
  ReconciliationBalanceResponse,
  ReconciliationErrorResponse,
  ReconciliationExceptionsResponse,
  ReconciliationMatchedResponse,
  ReconciliationSummaryResponse,
  SplitMatchRequest,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedReconciliationService } from '../services/shared-reconciliation-service';
import { bearerToken, unauthorizedForSession } from './session-auth';

/** The reconciliation view's independently-fetched sections — each is one endpoint and one error boundary. */
export type ReconciliationSection = 'summary' | 'exceptions' | 'matched' | 'balance';

/**
 * Demo/e2e control: sections named here return a 500 so a viewer can see one panel fail in isolation
 * while the rest of the page renders. A module-level flag (not a one-shot worker.use override) so the
 * demo Beacon toggle can turn the failure back OFF — see browser.ts.
 */
const armedFailures = new Set<ReconciliationSection>();
export function setReconciliationSectionFailure(
  section: ReconciliationSection,
  armed: boolean,
): void {
  if (armed) armedFailures.add(section);
  else armedFailures.delete(section);
}
export function isReconciliationSectionFailureArmed(section: ReconciliationSection): boolean {
  return armedFailures.has(section);
}

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
  const body: ReconciliationErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter in front of ReconciliationService. Every endpoint is auth-gated and independently
 * re-checks `reconciliation:view` server-side (the route guard is never the security boundary), and
 * honours the armed-failure flag so one section can 500 while its siblings succeed.
 */
export function createReconciliationHandlers(
  service: ReconciliationService = sharedReconciliationService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  /** Auth + server-side reconciliation:view check, shared by every endpoint. */
  function authorize(request: Request) {
    const permissions = resolvePermissions(request, authService);
    if (!permissions) return { fail: unauthorizedForSession(request, authService) };
    if (!hasPermission(permissions, 'reconciliation:view')) return { fail: forbidden() };
    return { fail: null };
  }

  /** authorize(), then honour a section's armed failure — so one section can 500 while its siblings succeed. */
  function guard(request: Request, section: ReconciliationSection) {
    const authorized = authorize(request);
    if (authorized.fail) return authorized;
    if (armedFailures.has(section)) {
      return { fail: HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }) };
    }
    return { fail: null };
  }

  function notFound() {
    const body: ReconciliationErrorResponse = { error: 'exception_not_found' };
    return HttpResponse.json(body, { status: 404 });
  }

  return [
    http.get('*/api/reconciliation/summary', ({ request }) => {
      const { fail } = guard(request, 'summary');
      if (fail) return fail;
      const body: ReconciliationSummaryResponse = { summary: service.getSummary() };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/reconciliation/exceptions', ({ request }) => {
      const { fail } = guard(request, 'exceptions');
      if (fail) return fail;
      const body: ReconciliationExceptionsResponse = { exceptions: service.getExceptions() };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/reconciliation/matched', ({ request }) => {
      const { fail } = guard(request, 'matched');
      if (fail) return fail;
      const body: ReconciliationMatchedResponse = { matched: service.getMatched() };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/reconciliation/balance', ({ request }) => {
      const { fail } = guard(request, 'balance');
      if (fail) return fail;
      const body: ReconciliationBalanceResponse = { balance: service.getBalance() };
      return HttpResponse.json(body, { status: 200 });
    }),

    // Re-run the nightly job on demand ("Run again"). Auth-gated but independent of section failures.
    http.post('*/api/reconciliation/run', ({ request }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      service.runReconciliation();
      const body: ReconciliationSummaryResponse = { summary: service.getSummary() };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.post('*/api/reconciliation/exceptions/:id/confirm', ({ request, params }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      const matched = service.confirmMatch(String(params.id));
      if (!matched) return notFound();
      return HttpResponse.json({ matched }, { status: 200 });
    }),

    http.post('*/api/reconciliation/exceptions/:id/reject', ({ request, params }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      if (!service.rejectSuggestion(String(params.id))) return notFound();
      return HttpResponse.json({ ok: true }, { status: 200 });
    }),

    http.post('*/api/reconciliation/exceptions/:id/dismiss', ({ request, params }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      if (!service.dismiss(String(params.id))) return notFound();
      return HttpResponse.json({ ok: true }, { status: 200 });
    }),

    http.post('*/api/reconciliation/exceptions/:id/split', async ({ request, params }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      const { portions } = (await request.json()) as SplitMatchRequest;
      const outcome = service.splitMatch(String(params.id), portions);
      if (!outcome) return notFound();
      if (!outcome.ok) {
        const body: ReconciliationErrorResponse = {
          error: 'split_mismatch',
          expected: outcome.expected,
          provided: outcome.provided,
        };
        return HttpResponse.json(body, { status: 422 });
      }
      return HttpResponse.json({ matched: outcome.matched }, { status: 200 });
    }),
  ];
}

export const reconciliationHandlers = createReconciliationHandlers();
