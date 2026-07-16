import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { DashboardPage } from './DashboardPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const usd = (amountMinorUnits: number) => ({ amountMinorUnits, currency: 'USD' });

function summaryBody(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      totalSpend: usd(38_493_000),
      pendingApprovalsCount: 7,
      pendingApprovalsAmount: usd(4_821_000),
      budgetRemaining: usd(14_200_000),
      budgetTotal: usd(62_900_000),
      activeCards: 24,
      frozenCards: 3,
      transactionCount: 12,
      lastRefreshedAt: new Date(Date.now() - 60_000).toISOString(),
      ...overrides,
    },
  };
}

const CATEGORIES = {
  categories: [
    { category: 'Payroll & Benefits', amount: usd(20_420_000), fractionOfMax: 1 },
    { category: 'Software', amount: usd(7_313_000), fractionOfMax: 0.36 },
  ],
};
const DEPARTMENTS = {
  departments: [
    { department: 'Engineering', amount: usd(6_021_000) },
    { department: 'Sales', amount: usd(2_220_000) },
  ],
};
const VENDORS = { vendors: [{ vendor: 'Gusto', amount: usd(20_420_000) }] };
const ACTIVITY = {
  transactions: [
    {
      id: 'txn_1',
      vendor: 'WeWork',
      category: 'Office & Facilities',
      date: '2026-06-26',
      amount: usd(4_240_000),
      anomaly: { confidencePercent: 87, normalAmount: usd(1_100_000) },
    },
    {
      id: 'txn_2',
      vendor: 'Gusto',
      category: 'Payroll',
      date: '2026-06-28',
      amount: usd(18_620_000),
    },
  ],
};

/** Register all five section endpoints (+ refresh), overridable per test for the failure/empty cases. */
function stubAnalytics(
  over: {
    summary?: unknown;
    categories?: unknown;
    departments?: unknown;
    vendors?: () => Response | Promise<Response>;
    activity?: unknown;
  } = {},
) {
  server.use(
    http.get('*/api/analytics/summary', () => HttpResponse.json(over.summary ?? summaryBody())),
    http.get('*/api/analytics/spend-by-category', () =>
      HttpResponse.json(over.categories ?? CATEGORIES),
    ),
    http.get('*/api/analytics/by-department', () =>
      HttpResponse.json(over.departments ?? DEPARTMENTS),
    ),
    http.get('*/api/analytics/top-vendors', () =>
      over.vendors ? over.vendors() : HttpResponse.json(VENDORS),
    ),
    http.get('*/api/analytics/recent-activity', () => HttpResponse.json(over.activity ?? ACTIVITY)),
    http.post('*/api/analytics/refresh', () => HttpResponse.json(summaryBody())),
  );
}

function renderDashboard() {
  setAccessToken('access_valid');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('renders category, department and vendor breakdowns, with money from skeletons — never $0.00 (AC-01)', async () => {
    stubAnalytics();
    const { container } = renderDashboard();

    // While loading, money is a shimmer skeleton — never a false zero.
    expect(container.querySelector('.cl-skeleton')).not.toBeNull();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();

    expect(await screen.findByText('Payroll & Benefits')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getAllByText('Gusto').length).toBeGreaterThan(0);
    // The loaded total renders once its query resolves.
    expect(await screen.findByText('$384,930.00')).toBeInTheDocument();
  });

  it('flags an anomalous transaction with an icon + "Unusual amount" + AI confidence, not colour alone (AC-02)', async () => {
    stubAnalytics();
    renderDashboard();
    expect(await screen.findByText('Unusual amount')).toBeInTheDocument();
    expect(screen.getByText(/AI 87% confidence/)).toBeInTheDocument();
    expect(screen.getByText(/normally ~\$11,000/)).toBeInTheDocument();
  });

  it('shows an empty state — not an error — for a range with no transactions (AC-03)', async () => {
    stubAnalytics({ summary: summaryBody({ transactionCount: 0, totalSpend: usd(0) }) });
    renderDashboard();
    expect(await screen.findByText('No transactions in this date range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to June 2026/ })).toBeInTheDocument();
  });

  it('rejects an end-before-start range inline and keeps Apply disabled (AC-04)', async () => {
    const user = userEvent.setup();
    stubAnalytics();
    renderDashboard();
    await screen.findByText('Payroll & Benefits');

    await user.clear(screen.getByLabelText('End date'));
    await user.type(screen.getByLabelText('End date'), '2026-06-12');
    await user.clear(screen.getByLabelText('Start date'));
    await user.type(screen.getByLabelText('Start date'), '2026-06-30');

    expect(await screen.findByText('End date must be after the start date.')).toBeInTheDocument();
    // The Button conveys disabled via aria-disabled (it stays focusable for a11y), never applying the range.
    expect(screen.getByRole('button', { name: 'Apply range' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('isolates a failed section behind a scoped retry while the others render (AC-05)', async () => {
    stubAnalytics({
      vendors: () => HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }),
    });
    renderDashboard();

    // The other sections render normally.
    expect(await screen.findByText('Payroll & Benefits')).toBeInTheDocument();
    // Only Top vendors shows the scoped failure with a retry.
    expect(await screen.findByText("This section couldn't load.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('surfaces the data age and a manual Refresh when stale (AC-06)', async () => {
    stubAnalytics({
      summary: summaryBody({ lastRefreshedAt: new Date(Date.now() - 10 * 60_000).toISOString() }),
    });
    renderDashboard();
    expect(await screen.findByText('Last updated 10 minutes ago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
  });
});
