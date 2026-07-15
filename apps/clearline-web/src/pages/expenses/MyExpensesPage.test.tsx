import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { MyExpensesPage } from './MyExpensesPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const EXPENSES = [
  {
    id: 'exp_4490',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    categoryId: 'travel',
    categoryLabel: 'Travel',
    merchant: 'United Airlines',
    amount: { amountMinorUnits: 124_000, currency: 'USD' },
    submittedDate: '2026-06-24',
    status: 'pending_l2',
  },
  {
    id: 'exp_4402',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    categoryId: 'software',
    categoryLabel: 'Software',
    merchant: 'JetBrains',
    amount: { amountMinorUnits: 35_000, currency: 'USD' },
    submittedDate: '2026-06-12',
    status: 'rejected',
    rejectionReason: 'Exceeds the $200.00 Software policy limit.',
  },
];

function renderPage(expenses: unknown[] = EXPENSES) {
  setAccessToken('access_valid');
  server.use(http.get('*/api/expenses', () => HttpResponse.json({ expenses })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/expenses']}>
        <Routes>
          <Route path="/expenses" element={<MyExpensesPage />} />
          <Route path="/expenses/new" element={<div>New expense stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyExpensesPage', () => {
  it('lists the submitted expenses with their status', async () => {
    renderPage();
    expect(await screen.findByText('United Airlines')).toBeInTheDocument();
    expect(screen.getByText('Pending L2')).toBeInTheDocument();
  });

  it('shows the rejection reason on a rejected expense (AC-02)', async () => {
    renderPage();
    expect(
      await screen.findByText(/Exceeds the \$200.00 Software policy limit/),
    ).toBeInTheDocument();
  });

  it('navigates to the new-expense form from "New expense"', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('United Airlines');
    await user.click(screen.getByRole('button', { name: /New expense/ }));
    expect(await screen.findByText('New expense stub')).toBeInTheDocument();
  });

  it('shows an empty state when there are no expenses', async () => {
    renderPage([]);
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
  });
});
