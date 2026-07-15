import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { NewExpensePage } from './NewExpensePage';

// The New Expense form's validation/submit logic is covered against the real domain gate in
// use-new-expense-form.test.tsx (the category picker is a Radix Select happy-dom can't open). This
// smoke test covers the page-level render and access-denied wiring.
const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderPage() {
  setAccessToken('access_valid');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/expenses/new']}>
        <Routes>
          <Route path="/expenses/new" element={<NewExpensePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NewExpensePage', () => {
  it('renders the form once the context loads', async () => {
    server.use(
      http.get('*/api/expenses/context', () =>
        HttpResponse.json({
          categories: [{ id: 'travel', label: 'Travel' }],
          receiptRequiredThresholdMinorUnits: 7_500,
          currency: 'USD',
        }),
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'New expense' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows access-denied when the context read is forbidden', async () => {
    server.use(
      http.get('*/api/expenses/context', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText(/403 Forbidden/)).toBeInTheDocument());
  });
});
