import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AnalyticsForbiddenError } from './analytics-forbidden-error';
import { useSpendSummary } from './use-spend-summary';
import { useTopVendors } from './use-top-vendors';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });
const RANGE = { from: '2026-06-01', to: '2026-06-30' };

afterEach(() => clearAccessToken());

describe('useSpendSummary', () => {
  it('sends the range as query params and resolves with the summary', async () => {
    setAccessToken('access_valid');
    let seenUrl = '';
    server.use(
      http.get('*/api/analytics/summary', ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          summary: { transactionCount: 12, lastRefreshedAt: '2026-07-16T12:00:00.000Z' },
        });
      }),
    );

    const { result } = renderHook(() => useSpendSummary(RANGE), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary.transactionCount).toBe(12);
    expect(seenUrl).toContain('from=2026-06-01');
    expect(seenUrl).toContain('to=2026-06-30');
  });

  it('surfaces a 403 as AnalyticsForbiddenError', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/analytics/summary', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useSpendSummary(RANGE), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AnalyticsForbiddenError);
  });
});

describe('useTopVendors', () => {
  it('surfaces a 500 as a section error so the page can scope the failure (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/analytics/top-vendors', () =>
        HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useTopVendors(RANGE), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(AnalyticsForbiddenError);
  });
});
