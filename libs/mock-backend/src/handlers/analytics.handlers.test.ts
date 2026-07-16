import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createAnalyticsHandlers, setAnalyticsSectionFailure } from './analytics.handlers';
import { AuthService } from '../services/auth.service';
import { AnalyticsService } from '../services/analytics.service';
import { SEED_USERS, DEMO_USER_PASSWORD } from '../fixtures/users.fixture';

const financeManager = SEED_USERS.find((u) => u.role === 'finance_manager')!;
const employee = SEED_USERS.find((u) => u.role === 'employee')!;
const IP = '127.0.0.1 (mocked)';
const ORIGIN = 'http://analytics-test.example';

let authService: AuthService;
let analyticsService: AnalyticsService;
let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer();
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  // Clear any armed section failure so it never leaks into the next test.
  setAnalyticsSectionFailure('top-vendors', false);
  setAnalyticsSectionFailure('summary', false);
});
afterAll(() => server.close());

beforeEach(() => {
  authService = new AuthService();
  analyticsService = new AnalyticsService();
  server.use(...createAnalyticsHandlers(analyticsService, authService));
});

async function loginAs(email: string): Promise<string> {
  const { accessToken } = await authService.login(email, DEMO_USER_PASSWORD, IP);
  return accessToken!;
}

function get(path: string, token?: string) {
  return fetch(`${ORIGIN}/api/analytics/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/analytics/*', () => {
  it('returns the summary for a Finance Manager (has analytics:view)', async () => {
    const token = await loginAs(financeManager.email);
    const response = await get('summary', token);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary.transactionCount).toBeGreaterThan(0);
    expect(typeof body.summary.lastRefreshedAt).toBe('string');
  });

  it('returns the section breakdowns', async () => {
    const token = await loginAs(financeManager.email);
    expect(
      (await (await get('spend-by-category', token)).json()).categories.length,
    ).toBeGreaterThan(0);
    expect((await (await get('by-department', token)).json()).departments.length).toBeGreaterThan(
      0,
    );
    expect((await (await get('top-vendors', token)).json()).vendors.length).toBeGreaterThan(0);
    expect(
      (await (await get('recent-activity', token)).json()).transactions.length,
    ).toBeGreaterThan(0);
  });

  it('honours the from/to range query, returning an empty set outside the seeded month (AC-03)', async () => {
    const token = await loginAs(financeManager.email);
    const response = await get('summary?from=2026-07-01&to=2026-07-07', token);
    const body = await response.json();
    expect(body.summary.transactionCount).toBe(0);
  });

  it('returns 401 without an access token', async () => {
    expect((await get('summary')).status).toBe(401);
  });

  it('returns 403 for an Employee (no analytics:view)', async () => {
    const token = await loginAs(employee.email);
    const response = await get('summary', token);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('forbidden_role');
  });

  it('fails only the armed section, leaving the others healthy (AC-05)', async () => {
    const token = await loginAs(financeManager.email);
    setAnalyticsSectionFailure('top-vendors', true);
    expect((await get('top-vendors', token)).status).toBe(500);
    // Sibling sections are unaffected by the isolated failure.
    expect((await get('spend-by-category', token)).status).toBe(200);
    expect((await get('summary', token)).status).toBe(200);
  });

  it('refresh advances the freshness stamp (AC-06)', async () => {
    const token = await loginAs(financeManager.email);
    const before = (await (await get('summary', token)).json()).summary.lastRefreshedAt;
    const refreshed = await fetch(`${ORIGIN}/api/analytics/refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refreshed.status).toBe(200);
    const after = (await refreshed.json()).summary.lastRefreshedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it('refresh is not blocked by an armed section failure — refreshing must always be possible', async () => {
    const token = await loginAs(financeManager.email);
    setAnalyticsSectionFailure('summary', true);
    const refreshed = await fetch(`${ORIGIN}/api/analytics/refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refreshed.status).toBe(200);
  });
});
