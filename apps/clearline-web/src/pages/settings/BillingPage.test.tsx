import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import type { BillingSummary } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { BillingPage } from './BillingPage';
import { withQueryClient } from '../../test/with-query-client';

// Radix overlays need these DOM APIs happy-dom lacks.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

const server = registerMswServer();
afterEach(() => clearAccessToken());

const COMPANY = 'Acme Test Co';

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    planName: 'Growth',
    cycle: 'monthly',
    companyName: COMPANY,
    nextBillingDate: '2026-08-01',
    amountDue: { amountMinorUnits: 49900, currency: 'USD' },
    usage: {
      members: { used: 4, limit: 25 },
      cards: { used: 12, limit: 50 },
      transactions: { used: 920, limit: 1000 },
    },
    paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2028 },
    invoices: [
      {
        id: 'inv_2026-06',
        period: '2026-06',
        issuedAt: '2026-06-01',
        amount: { amountMinorUnits: 49900, currency: 'USD' },
      },
    ],
    status: 'active',
    accessUntil: null,
    ...overrides,
  };
}

function mockBackend({
  authorized = true,
  data = summary(),
  paymentMethod = () =>
    HttpResponse.json({
      paymentMethod: { brand: 'visa', last4: '1111', expMonth: 1, expYear: 2030 },
    }),
}: {
  authorized?: boolean;
  data?: BillingSummary;
  paymentMethod?: () => Response;
} = {}) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/billing', () =>
      authorized
        ? HttpResponse.json(data)
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.post('*/api/billing/payment-method', paymentMethod),
    http.post('*/api/billing/cancel', () =>
      HttpResponse.json({ status: 'canceled_grace', accessUntil: '2026-08-01' }),
    ),
  );
}

function renderPage() {
  render(
    <ThemeProvider>
      <MemoryRouter>{withQueryClient(<BillingPage />)}</MemoryRouter>
    </ThemeProvider>,
  );
}

describe('BillingPage (US-CW-042)', () => {
  it('degrades to AccessDenied on an independent 403 (AC-08)', async () => {
    mockBackend({ authorized: false });
    renderPage();
    await waitFor(() => expect(screen.getByText(/403 Forbidden/)).toBeInTheDocument());
  });

  it('shows the plan and an icon+text approaching-limit indicator (AC-01)', async () => {
    mockBackend();
    renderPage();
    await waitFor(() => expect(screen.getByText('Growth plan')).toBeInTheDocument());
    expect(screen.getByText('Approaching limit')).toBeInTheDocument();
  });

  it('shows a decline message and leaves the flow open when a card is declined (AC-03)', async () => {
    mockBackend({
      paymentMethod: () => HttpResponse.json({ error: 'card_declined' }, { status: 402 }),
    });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Update payment method' }));
    await user.type(await screen.findByLabelText(/Card \(Stripe test token\)/), 'tok_declined');
    await user.click(screen.getByRole('button', { name: 'Save card' }));
    expect(await screen.findByText('Your card was declined.')).toBeInTheDocument();
  });

  it('keeps the final cancel button disabled until the exact company name is typed (AC-05)', async () => {
    mockBackend();
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    // Step 1 → Continue into the typed-confirmation step.
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('button', { name: 'Cancel subscription' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');

    await user.type(screen.getByLabelText('Company name'), 'wrong name');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');

    await user.clear(screen.getByLabelText('Company name'));
    await user.type(screen.getByLabelText('Company name'), COMPANY);
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a read-only grace banner and hides the cancel action once cancelled (AC-07)', async () => {
    mockBackend({ data: summary({ status: 'canceled_grace', accessUntil: '2026-08-01' }) });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/read-only access until 2026-08-01/)).toBeInTheDocument(),
    );
    // No cancel affordance while already in grace.
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });
});
