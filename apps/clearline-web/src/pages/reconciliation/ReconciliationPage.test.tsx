import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ReconciliationPage } from './ReconciliationPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const usd = (amountMinorUnits: number) => ({ amountMinorUnits, currency: 'USD' });

function summaryBody(over: Record<string, unknown> = {}) {
  return {
    summary: {
      autoMatchedCount: 438,
      exceptionsCount: 3,
      matchRatePercent: 99.1,
      lastRunAt: '2026-06-29T09:00:00.000Z',
      feedSource: 'Plaid bank feed',
      ...over,
    },
  };
}

const SUGGESTED = {
  id: 'exc_bank_abc',
  bankTransaction: { id: 'bank_abc', payee: 'ABC Corp', amount: usd(320_000), date: '2026-06-27' },
  candidate: {
    id: 'led_abc',
    description: 'ABC Corporation',
    amount: usd(320_000),
    date: '2026-06-26',
  },
  status: 'suggested',
  similarityPercent: 78,
  fieldBreakdown: [
    { field: 'name', verdict: 'Fuzzy · 63%', tone: 'warning' },
    { field: 'amount', verdict: 'Exact', tone: 'positive' },
    { field: 'date', verdict: 'Within 1 day', tone: 'positive' },
  ],
  reason: 'Suggested match',
};
const UNMATCHED = {
  id: 'exc_bank_stripe',
  bankTransaction: {
    id: 'bank_stripe',
    payee: 'Stripe Payout',
    amount: usd(742_100),
    date: '2026-06-27',
  },
  status: 'unmatched',
  reason: 'No candidate found',
};
const SPLIT_TARGET = {
  id: 'exc_bank_acme',
  bankTransaction: {
    id: 'bank_acme',
    payee: 'Acme Wholesale',
    amount: usd(500_000),
    date: '2026-06-24',
  },
  status: 'unmatched',
  reason: 'Matches multiple invoices',
  splitCandidates: [
    { id: 'led_inv_20418', description: 'INV-20418', amount: usd(300_000), date: '2026-06-24' },
    { id: 'led_inv_20419', description: 'INV-20419', amount: usd(200_000), date: '2026-06-24' },
  ],
};

const AMBIGUOUS = {
  id: 'exc_bank_wework',
  bankTransaction: {
    id: 'bank_wework',
    payee: 'WeWork',
    amount: usd(424_000),
    date: '2026-06-26',
  },
  candidate: {
    id: 'led_wework_a',
    description: 'WeWork',
    amount: usd(424_000),
    date: '2026-06-26',
  },
  status: 'ambiguous',
  reason: 'Possible duplicate',
};

const MATCHED = {
  matched: [
    {
      id: 'match_bank_northwind',
      bankTransaction: {
        id: 'bank_northwind',
        payee: 'Northwind Traders',
        amount: usd(500_000),
        date: '2026-06-28',
      },
      ledgerEntries: [
        {
          id: 'led_northwind',
          description: 'Northwind Traders',
          amount: usd(500_000),
          date: '2026-06-28',
        },
      ],
      method: 'exact',
      reconciledAt: '2026-06-29T09:00:00.000Z',
    },
  ],
};

function stub(
  over: {
    summary?: unknown;
    exceptions?: unknown;
    matched?: unknown;
    balance?: unknown;
  } = {},
) {
  server.use(
    http.get('*/api/reconciliation/summary', () =>
      HttpResponse.json(over.summary ?? summaryBody()),
    ),
    http.get('*/api/reconciliation/exceptions', () =>
      HttpResponse.json(
        over.exceptions ?? { exceptions: [SUGGESTED, UNMATCHED, SPLIT_TARGET, AMBIGUOUS] },
      ),
    ),
    http.get('*/api/reconciliation/matched', () => HttpResponse.json(over.matched ?? MATCHED)),
    http.get('*/api/reconciliation/balance', () =>
      HttpResponse.json(
        over.balance ?? {
          balance: {
            status: 'ok',
            accountLabel: 'Operating · ••4021',
            availableBalance: usd(1_866_000),
          },
        },
      ),
    ),
    http.post('*/api/reconciliation/exceptions/:id/confirm', () =>
      HttpResponse.json({ matched: { id: 'm', method: 'fuzzy', ledgerEntries: [] } }),
    ),
  );
}

function renderPage() {
  setAccessToken('access_valid');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reconciliation']}>
        <Routes>
          <Route path="/reconciliation" element={<ReconciliationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReconciliationPage', () => {
  it('auto-matches an exact line: it appears under Matched, tagged Matched, not in the queue (AC-01)', async () => {
    const user = userEvent.setup();
    stub();
    renderPage();

    // Auto-matched headline count from the run.
    expect(await screen.findByText('438')).toBeInTheDocument();
    // It isn't an exception.
    expect(screen.queryByText('Northwind Traders')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Matched/ }));
    // Appears as both the bank payee and the ledger description on the matched row.
    expect((await screen.findAllByText('Northwind Traders')).length).toBeGreaterThan(0);
    // The reconciled row carries the "Matched" status badge.
    expect(screen.getAllByText('Matched').length).toBeGreaterThan(0);
  });

  it('shows an unmatched line in the queue, labelled Unmatched, still actionable (AC-02)', async () => {
    stub();
    renderPage();
    expect(await screen.findByText('Stripe Payout')).toBeInTheDocument();
    expect(screen.getAllByText('Unmatched').length).toBeGreaterThan(0);
    // Actionable, not hidden: a Dismiss control is present for the unmatched line.
    expect(screen.getAllByRole('button', { name: 'Dismiss' }).length).toBeGreaterThan(0);
  });

  it('surfaces a fuzzy suggestion with a score + breakdown and lets it be confirmed (AC-03)', async () => {
    const user = userEvent.setup();
    stub();
    renderPage();

    await screen.findByText('ABC Corp');
    // The score pill is shown in the queue.
    expect(screen.getByText('78% match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review' }));

    // Dialog: similarity + per-field breakdown, then confirm.
    expect(await screen.findByText('78% similarity')).toBeInTheDocument();
    expect(screen.getByText('Fuzzy · 63%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm match/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('offers a Match action on an ambiguous (possible-duplicate) line', async () => {
    stub();
    renderPage();
    // The ambiguous WeWork line shows a "Review"-labelled status and a distinct Match action.
    expect((await screen.findAllByText('WeWork')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Match' })).toBeInTheDocument();
  });

  it('captions the Matched tab with the shown-vs-total auto-matched count', async () => {
    const user = userEvent.setup();
    stub();
    renderPage();
    await screen.findByText('438');
    await user.click(screen.getByRole('tab', { name: /Matched/ }));
    expect(
      await screen.findByText(/Showing the 1 most recent of 438 auto-matched transactions\./),
    ).toBeInTheDocument();
  });

  it('withholds the balance behind a Fatal-tier notice with a support ref — never $0.00 (AC-04)', async () => {
    stub({
      balance: {
        balance: {
          status: 'integrity_failure',
          accountLabel: 'Operating · ••4021',
          supportReference: 'REC-3B81-F009',
        },
      },
    });
    renderPage();

    expect(
      await screen.findByText("We're double-checking your balance. This may take a moment."),
    ).toBeInTheDocument();
    expect(screen.getByText('REC-3B81-F009')).toBeInTheDocument();
    expect(screen.getByText('Fatal-tier')).toBeInTheDocument();
    // The balance number is withheld — never a false zero.
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('validates a split sums exactly, keeping Confirm disabled with the error until it balances (AC-05)', async () => {
    const user = userEvent.setup();
    stub();
    renderPage();

    await screen.findByText('Acme Wholesale');
    // Only the Acme line has split candidates, so its Split button is unique.
    await user.click(screen.getByRole('button', { name: 'Split' }));

    expect(await screen.findByText('Split match')).toBeInTheDocument();

    // Break the balance: 3000 + 1000 = 4000, not 5000.
    const secondInput = screen.getByLabelText('Amount for INV-20419');
    await user.clear(secondInput);
    await user.type(secondInput, '1000');

    expect(
      await screen.findByText('The split amounts must add up to the full transaction amount.'),
    ).toBeInTheDocument();
    // The Button conveys disabled via aria-disabled (it stays focusable for a11y).
    expect(screen.getByRole('button', { name: /Confirm split match/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    // Fix it: 3000 + 2000 = 5000.
    await user.clear(secondInput);
    await user.type(secondInput, '2000');
    expect(screen.getByText('Splits balance')).toBeInTheDocument();
    // Enabled: the Button omits aria-disabled entirely rather than setting it "false".
    expect(screen.getByRole('button', { name: /Confirm split match/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('isolates a failed panel behind its own retry while the others render (AC-05 resilience)', async () => {
    stub();
    // Override the exceptions panel to fail — a later handler wins in MSW.
    server.use(
      http.get('*/api/reconciliation/exceptions', () =>
        HttpResponse.json({ error: 'section_unavailable' }, { status: 500 }),
      ),
    );
    renderPage();

    // Summary still renders.
    expect(await screen.findByText('438')).toBeInTheDocument();
    // Exceptions panel shows the scoped failure.
    expect(await screen.findByText("This section couldn't load.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });
});
