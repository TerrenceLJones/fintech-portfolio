import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IssueCardContextResponse, IssueCardRequest } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { IssueCardPage } from './IssueCardPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const CONTEXT: IssueCardContextResponse = {
  candidates: [
    { id: 'emp_reyes', name: 'Dara Reyes', initials: 'DR', team: 'Design' },
    { id: 'emp_nair', name: 'Priya Nair', initials: 'PN', team: 'Eng' },
  ],
  merchantCategories: [
    { code: 'software', label: 'Software' },
    { code: 'office_supplies', label: 'Office Supplies' },
    { code: 'travel', label: 'Travel' },
  ],
};

function renderPage() {
  setAccessToken('access_valid');
  server.use(http.get('*/api/cards/context', () => HttpResponse.json(CONTEXT)));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/cards/new']}>
        <Routes>
          <Route path="/cards/new" element={<IssueCardPage />} />
          <Route path="/cards/:cardId" element={<div>Card detail stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('IssueCardPage (US-CW-014 AC-01)', () => {
  it('issues a card with the chosen holder, limit and MCC restrictions, then opens its feed', async () => {
    const user = userEvent.setup();
    let received: IssueCardRequest | undefined;
    renderPage();
    server.use(
      http.post('*/api/cards', async ({ request }) => {
        received = (await request.json()) as IssueCardRequest;
        return HttpResponse.json(
          {
            card: {
              id: 'card_new',
              holderName: 'Dara Reyes — Design',
              holderInitials: 'DR',
              last4: '4102',
              exp: '09/28',
              monthlyLimit: received.monthlyLimit,
              authorizedSpend: { amountMinorUnits: 0, currency: 'USD' },
              status: 'active',
              allowedMccs: received.allowedMccs,
            },
          },
          { status: 201 },
        );
      }),
    );

    await user.click(await screen.findByRole('button', { name: /Dara Reyes/ }));
    await user.type(screen.getByLabelText('Monthly limit'), '2000');
    await user.click(screen.getByRole('button', { name: /^Software$/ }));
    await user.click(screen.getByRole('button', { name: /Office Supplies/ }));
    await user.click(screen.getByRole('button', { name: /Issue card/ }));

    expect(await screen.findByText('Card detail stub')).toBeInTheDocument();
    expect(received).toEqual({
      holderId: 'emp_reyes',
      monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
      allowedMccs: ['software', 'office_supplies'],
    });
  });

  it('degrades to Access denied when the server forbids the issuance context (redundant server guard)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/cards/context', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cards/new']}>
          <Routes>
            <Route path="/cards/new" element={<IssueCardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/don't have access/i)).toBeInTheDocument();
    expect(screen.getByText('403 Forbidden · GET /api/cards/context')).toBeInTheDocument();
  });

  it('keeps "Issue card" disabled until a holder and a positive limit are set', async () => {
    const user = userEvent.setup();
    renderPage();
    const issueButton = await screen.findByRole('button', { name: /Issue card/ });
    expect(issueButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(await screen.findByRole('button', { name: /Dara Reyes/ }));
    await user.type(screen.getByLabelText('Monthly limit'), '2000');
    expect(issueButton).not.toHaveAttribute('aria-disabled', 'true');
  });
});
