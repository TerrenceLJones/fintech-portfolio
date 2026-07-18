import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AnalyticsErrorResponse,
  ByDepartmentResponse,
  DateRange,
  Permission,
  RecentActivityResponse,
  SpendByCategoryResponse,
  SpendSummaryResponse,
  TopVendorsResponse,
} from '@clearline/contracts';
import { hasPermission, permissionsForRole } from '@clearline/domain-auth';
import { AuthService } from '../services/auth.service';
import { AnalyticsService, DEFAULT_ANALYTICS_RANGE } from '../services/analytics.service';
import { sharedAuthService } from '../services/shared-auth-service';
import { sharedAnalyticsService } from '../services/shared-analytics-service';
import { bearerToken, unauthorizedForSession } from './session-auth';

/** The dashboard's independently-fetched sections — each is one endpoint and one error boundary (AC-05). */
export type AnalyticsSection =
  'summary' | 'spend-by-category' | 'by-department' | 'top-vendors' | 'recent-activity';

/**
 * Demo/e2e control for AC-05: sections named here return a 500 so a viewer can see one section fail
 * in isolation while the rest of the page renders. A module-level flag (not a one-shot worker.use
 * override) so the demo Beacon toggle can turn the failure back OFF — see browser.ts.
 */
const armedFailures = new Set<AnalyticsSection>();
export function setAnalyticsSectionFailure(section: AnalyticsSection, armed: boolean): void {
  if (armed) armedFailures.add(section);
  else armedFailures.delete(section);
}
export function isAnalyticsSectionFailureArmed(section: AnalyticsSection): boolean {
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

/** Read the inclusive from/to range off the query string, falling back to the seeded default month. */
function rangeFromRequest(request: Request): DateRange {
  const url = new URL(request.url);
  return {
    from: url.searchParams.get('from') ?? DEFAULT_ANALYTICS_RANGE.from,
    to: url.searchParams.get('to') ?? DEFAULT_ANALYTICS_RANGE.to,
  };
}

function forbidden() {
  const body: AnalyticsErrorResponse = { error: 'forbidden_role' };
  return HttpResponse.json(body, { status: 403 });
}

/**
 * Thin HTTP adapter in front of AnalyticsService. Every endpoint is auth-gated and independently
 * re-checks `analytics:view` server-side (US-CW-015's route guard is never the security boundary),
 * and honours the armed-failure flag so one section can fail while its siblings succeed (AC-05).
 */
export function createAnalyticsHandlers(
  analyticsService: AnalyticsService = sharedAnalyticsService,
  authService: AuthService = sharedAuthService,
): HttpHandler[] {
  /** Auth + server-side analytics:view check, shared by every endpoint. */
  function authorize(request: Request) {
    const permissions = resolvePermissions(request, authService);
    if (!permissions) return { fail: unauthorizedForSession(request, authService) };
    if (!hasPermission(permissions, 'analytics:view')) return { fail: forbidden() };
    return { fail: null };
  }

  /** authorize(), then honour a section's armed failure — so one section can 500 while its siblings succeed (AC-05). */
  function guard(request: Request, section: AnalyticsSection) {
    const authorized = authorize(request);
    if (authorized.fail) return authorized;
    if (armedFailures.has(section)) {
      return { fail: HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }) };
    }
    return { fail: null };
  }

  return [
    http.get('*/api/analytics/summary', ({ request }) => {
      const { fail } = guard(request, 'summary');
      if (fail) return fail;
      const body: SpendSummaryResponse = {
        summary: analyticsService.getSummary(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/analytics/spend-by-category', ({ request }) => {
      const { fail } = guard(request, 'spend-by-category');
      if (fail) return fail;
      const body: SpendByCategoryResponse = {
        categories: analyticsService.getSpendByCategory(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/analytics/by-department', ({ request }) => {
      const { fail } = guard(request, 'by-department');
      if (fail) return fail;
      const body: ByDepartmentResponse = {
        departments: analyticsService.getByDepartment(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/analytics/top-vendors', ({ request }) => {
      const { fail } = guard(request, 'top-vendors');
      if (fail) return fail;
      const body: TopVendorsResponse = {
        vendors: analyticsService.getTopVendors(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    http.get('*/api/analytics/recent-activity', ({ request }) => {
      const { fail } = guard(request, 'recent-activity');
      if (fail) return fail;
      const body: RecentActivityResponse = {
        transactions: analyticsService.getRecentActivity(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),

    // The manual Refresh advances the freshness stamp, then the client refetches every section (AC-06).
    // Auth-gated but independent of any section's armed failure — refreshing must never be blocked by a
    // simulated section outage.
    http.post('*/api/analytics/refresh', ({ request }) => {
      const { fail } = authorize(request);
      if (fail) return fail;
      analyticsService.refresh();
      const body: SpendSummaryResponse = {
        summary: analyticsService.getSummary(rangeFromRequest(request)),
      };
      return HttpResponse.json(body, { status: 200 });
    }),
  ];
}

export const analyticsHandlers = createAnalyticsHandlers();
