import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VirtualCard } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { CardWalletPage } from './CardWalletPage';

const server = registerMswServer();
afterEach(() => {
  clearAccessToken();
  sessionStorage.clear();
});

function card(overrides: Partial<VirtualCard> = {}): VirtualCard {
  return {
    id: 'card_4021',
    holderName: 'Dara Reyes — Design',
    holderInitials: 'DR',
    last4: '4021',
    exp: '09/28',
    monthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
    authorizedSpend: { amountMinorUnits: 15_000, currency: 'USD' },
    status: 'active',
    allowedMccs: ['software', 'office_supplies'],
    ...overrides,
  };
}

const WALLET: VirtualCard[] = [
  card(),
  card({ id: 'card_5567', holderName: 'Sam Park — Sales', last4: '5567', status: 'frozen' }),
];

function renderPage(role: 'controller' | 'employee' = 'controller', cards: VirtualCard[] = WALLET) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/cards', () => HttpResponse.json({ cards })),
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Demo',
        role,
        approvalLimit: null,
        isAdmin: false,
        isOwner: false,
      }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/cards']}>
        <Routes>
          <Route path="/cards" element={<CardWalletPage />} />
          <Route path="/cards/new" element={<div>Issue stub</div>} />
          <Route path="/cards/:cardId" element={<div>Detail stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CardWalletPage', () => {
  it('lists the wallet with a derived remaining limit and status badges (US-CW-014 AC-01/AC-05)', async () => {
    renderPage();
    expect(await screen.findByText('Dara Reyes — Design')).toBeInTheDocument();
    // $2,000 limit − $150 spend = $1,850 remaining (derived) — shown on the card face and the footer.
    expect(screen.getAllByText('$1,850.00').length).toBeGreaterThanOrEqual(1);
    // Status reads through icon + text: an active card and a frozen one (the frozen card face also
    // carries its own inline "Frozen" pill, so the label appears more than once).
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Frozen').length).toBeGreaterThanOrEqual(1);
  });

  it('summarises the wallet as "N active · M frozen"', async () => {
    renderPage();
    expect(await screen.findByText(/1 active · 1 frozen/i)).toBeInTheDocument();
  });

  it('shows "Issue card" to a Controller and navigates to the issuance screen', async () => {
    renderPage('controller');
    const issue = await screen.findByRole('button', { name: /issue card/i });
    await userEvent.click(issue);
    expect(await screen.findByText('Issue stub')).toBeInTheDocument();
  });

  it('hides "Issue card" from a viewer without cards:manage (an Employee)', async () => {
    renderPage('employee');
    await screen.findByText('Dara Reyes — Design');
    expect(screen.queryByRole('button', { name: /issue card/i })).not.toBeInTheDocument();
  });
});
