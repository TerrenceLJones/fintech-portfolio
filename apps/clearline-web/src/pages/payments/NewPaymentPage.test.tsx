import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { NewPaymentPage } from './NewPaymentPage';

const server = registerMswServer();

afterEach(() => {
  clearAccessToken();
  sessionStorage.clear();
});

interface ContextOverrides {
  availableBalance?: number;
  dailySpent?: number;
}

function context({ availableBalance = 4_821_000, dailySpent = 0 }: ContextOverrides = {}) {
  return {
    source: {
      id: 'acct_operating',
      name: 'Operating',
      maskedAccount: '••4021',
      currency: 'USD',
      availableBalance: { amountMinorUnits: availableBalance, currency: 'USD' },
      dailyLimit: { amountMinorUnits: 2_000_000, currency: 'USD' },
      dailySpent: { amountMinorUnits: dailySpent, currency: 'USD' },
    },
    recipients: [
      {
        id: 'rec_acme',
        name: 'Acme Corp',
        maskedAccount: '••4188',
        method: 'ach',
        currency: 'USD',
        status: 'active',
      },
      {
        id: 'rec_vertex',
        name: 'Vertex Logistics',
        maskedAccount: '••7711',
        method: 'ach',
        currency: 'USD',
        status: 'closed',
      },
      {
        id: 'rec_self',
        name: 'Operating',
        maskedAccount: '••4021',
        method: 'ach',
        currency: 'USD',
        status: 'active',
      },
      {
        id: 'rec_globex',
        name: 'Globex GmbH',
        maskedAccount: '••3320',
        method: 'wire',
        currency: 'EUR',
        status: 'active',
      },
    ],
  };
}

function renderPage(overrides: ContextOverrides = {}) {
  setAccessToken('access_valid');
  server.use(http.get('*/api/payments/context', () => HttpResponse.json(context(overrides))));
  server.use(
    http.get('*/api/payments/fx', () =>
      HttpResponse.json({
        rate: { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.918 },
        convertedAmount: { amountMinorUnits: 459_000, currency: 'EUR' },
      }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/payments/new']}>
        <Routes>
          <Route path="/payments/new" element={<NewPaymentPage />} />
          <Route path="/payments/:intentId" element={<div>Status stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function chooseRecipientAndAmount(name: RegExp, amount: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name }));
  await user.type(screen.getByLabelText('Amount'), amount);
  await user.click(screen.getByRole('button', { name: /review & send/i }));
  return user;
}

describe('NewPaymentPage — derived balance', () => {
  it('shows the available balance as a derived, read-only value (US-CW-008)', async () => {
    renderPage();
    // The "Pay from" balance carries a DERIVED chip flagging it as a ledger projection…
    expect(await screen.findByText('DERIVED')).toBeInTheDocument();
    // …and no input affordance on the balance — there is no editable "available balance" field.
    expect(screen.queryByLabelText(/available balance/i)).not.toBeInTheDocument();
  });
});

describe('NewPaymentPage — accessible error association (US-CW-020 AC-04)', () => {
  it('ties the erroring field to the announced message via aria-describedby and marks it invalid', async () => {
    renderPage({ availableBalance: 300_000 });
    await chooseRecipientAndAmount(/Acme Corp/i, '5000');

    // The validation message is announced through a live region…
    const alert = await screen.findByRole('alert');
    expect(alert.id).toBeTruthy();

    // …and the amount field it refers to is programmatically associated with it, not merely
    // recoloured — a screen reader lands on the field and hears why it is invalid.
    const amount = screen.getByLabelText('Amount');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAttribute('aria-describedby', alert.id);
  });
});

describe('NewPaymentPage — client-side validation blocks (US-CW-008)', () => {
  it('blocks an over-balance payment before any network call, echoing the balance (AC-01)', async () => {
    renderPage({ availableBalance: 300_000 });
    await chooseRecipientAndAmount(/Acme Corp/i, '5000');
    expect(
      await screen.findByText(
        "You don't have enough available balance for this transfer. Available: $3,000.00.",
      ),
    ).toBeInTheDocument();
    // No confirm dialog opened — the submit was blocked.
    expect(screen.queryByText(/can't be undone/i)).not.toBeInTheDocument();
  });

  it('blocks an over-daily-limit payment and offers a limit-increase CTA (AC-02)', async () => {
    renderPage({ dailySpent: 1_800_000 });
    await chooseRecipientAndAmount(/Acme Corp/i, '5000');
    expect(
      await screen.findByText(
        'This exceeds your daily transfer limit of $20,000.00. Request a higher limit or enter a smaller amount.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request limit increase/i })).toBeInTheDocument();
  });

  it('blocks a closed-recipient payment (AC-04)', async () => {
    renderPage();
    await chooseRecipientAndAmount(/Vertex Logistics/i, '100');
    expect(
      await screen.findByText(
        "This recipient's account is no longer active. Contact them to get updated details.",
      ),
    ).toBeInTheDocument();
  });

  it('blocks a self-transfer (AC-05)', async () => {
    renderPage();
    await chooseRecipientAndAmount(/Operating/i, '100');
    expect(await screen.findByText("You can't transfer to the same account.")).toBeInTheDocument();
  });
});

describe('NewPaymentPage — pessimistic submission (US-CW-007 AC-01)', () => {
  it('opens an irreversible confirm dialog with a countdown rather than an instant success', async () => {
    renderPage();
    await chooseRecipientAndAmount(/Acme Corp/i, '5000');

    // Confirm dialog appears, armed only after a countdown — never an immediate "Success".
    expect(await screen.findByText('Send $5,000.00 to Acme Corp?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm in/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Success$/i)).not.toBeInTheDocument();
    // Still on the form — no navigation happened.
    expect(screen.queryByText('Status stub')).not.toBeInTheDocument();
  });
});

describe('NewPaymentPage — cross-currency (US-CW-008 AC-06)', () => {
  it('shows the converted amount and blocks send until it is confirmed', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Globex GmbH/i }));
    await user.type(screen.getByLabelText('Amount'), '5000');

    // Non-blocking banner + converted amount appear.
    expect(
      await screen.findByText(
        /This recipient uses EUR\. Review the converted amount before sending\./i,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText(/€4,590\.00/)).toBeInTheDocument();

    // Review is blocked until the converted amount is acknowledged.
    await user.click(screen.getByRole('button', { name: /review & send/i }));
    expect(
      await screen.findByText('Review and confirm the converted amount before sending.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/to Globex GmbH\?/)).not.toBeInTheDocument();

    // After confirming, the send dialog opens.
    await user.click(screen.getByLabelText(/confirm converted amount/i));
    await user.click(screen.getByRole('button', { name: /review & send/i }));
    expect(await screen.findByText(/to Globex GmbH\?/)).toBeInTheDocument();
  });

  it('surfaces a retryable error when the FX quote fails, rather than a silent dead-end', async () => {
    renderPage();
    const user = userEvent.setup();
    // The rate endpoint fails — without an error state this would leave the payment un-sendable.
    server.use(http.get('*/api/payments/fx', () => new HttpResponse(null, { status: 500 })));

    await user.click(await screen.findByRole('button', { name: /Globex GmbH/i }));
    await user.type(screen.getByLabelText('Amount'), '5000');

    // An actionable error with a Retry — not a missing checkbox and a contradictory prompt.
    expect(await screen.findByText(/couldn't fetch the exchange rate/i)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /^retry$/i });
    expect(screen.queryByLabelText(/confirm converted amount/i)).not.toBeInTheDocument();

    // Send stays blocked with a message that points at the retry, not at a nonexistent amount.
    await user.click(screen.getByRole('button', { name: /review & send/i }));
    expect(await screen.findByText(/retry to see the converted amount/i)).toBeInTheDocument();
    expect(screen.queryByText(/to Globex GmbH\?/)).not.toBeInTheDocument();

    // Recovery: the endpoint returns, retry fetches the quote, and the converted amount appears.
    server.use(
      http.get('*/api/payments/fx', () =>
        HttpResponse.json({
          rate: { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.918 },
          convertedAmount: { amountMinorUnits: 459_000, currency: 'EUR' },
        }),
      ),
    );
    await user.click(retry);
    expect(await screen.findByText(/€4,590\.00/)).toBeInTheDocument();
  });
});

describe('NewPaymentPage — session-expiry preservation (US-CW-007 AC-06)', () => {
  it('rehydrates the amount, recipient and idempotency key from a preserved draft', async () => {
    sessionStorage.setItem(
      'clearline:payment-draft',
      JSON.stringify({
        recipientId: 'rec_acme',
        amountInput: '1234',
        memo: 'Q2 platform license',
        method: 'ach',
        manualMode: false,
        routingNumber: '',
        accountNumber: '',
        idempotencyKey: '8f2a04b1-1c2d-4e3f-8a9b-1234567890c4',
      }),
    );
    renderPage();

    // Amount and recipient survive the round-trip through re-authentication.
    expect(await screen.findByDisplayValue('1234')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Acme Corp/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The same idempotency key is preserved, so re-auth resumes the exact payment intent.
    expect(screen.getByText(/8f2a04b1…/)).toBeInTheDocument();
  });
});
