import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { PaymentStatusPage } from './PaymentStatusPage';

const server = registerMswServer();

afterEach(() => clearAccessToken());

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_1',
    status: 'pending',
    amount: { amountMinorUnits: 500_000, currency: 'USD' },
    recipientName: 'Acme Corp',
    recipientMasked: '••4188',
    method: 'ach',
    createdDate: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function renderStatus(body: Record<string, unknown>) {
  setAccessToken('access_valid');
  server.use(http.get('*/api/payments/:id', () => HttpResponse.json({ intent: body })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/payments/pi_1']}>
        <Routes>
          <Route path="/payments/:intentId" element={<PaymentStatusPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PaymentStatusPage — compliance hold (US-CW-009 AC-01)', () => {
  it('shows a neutral "Pending review" with no screening terminology', async () => {
    renderStatus(intent({ status: 'pending_review' }));
    expect(await screen.findByText('Pending review')).toBeInTheDocument();
    expect(
      screen.getByText("This transfer is under review. We'll email you once it's complete."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sanction|watchlist|fraud/i)).not.toBeInTheDocument();
  });
});

describe('PaymentStatusPage — reversal (US-CW-009 AC-02)', () => {
  it('shows the reversed status and that funds were returned', async () => {
    renderStatus(
      intent({ status: 'reversed', reversedDate: 'Jun 26, 2026', reversingEntryId: 'jrn_91f4' }),
    );
    expect(await screen.findByText('Reversed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This payment was reversed on Jun 26, 2026. The funds were returned to your account.',
      ),
    ).toBeInTheDocument();
  });
});

describe('PaymentStatusPage — unrecognized status (US-CW-009 AC-03)', () => {
  it('degrades to a neutral "Processing" and logs the raw status without showing it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderStatus(intent({ status: 'network_settling' }));

    expect(await screen.findByText('Processing')).toBeInTheDocument();
    // The raw code never reaches the user...
    expect(screen.queryByText(/network_settling/i)).not.toBeInTheDocument();
    // ...but is logged for engineering triage.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('network_settling'));
    warn.mockRestore();
  });
});
