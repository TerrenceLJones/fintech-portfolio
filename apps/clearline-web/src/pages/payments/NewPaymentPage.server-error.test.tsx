import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import {
  PaymentTimeoutError,
  PaymentValidationError,
  useCreatePayment,
} from '@clearline/data-access-payments';
import { NewPaymentPage } from './NewPaymentPage';
import { buildMutationResult } from '../../test/build-mutation-result';

// The retry/backoff/timeout mechanics are covered in libs/data-access/payments' use-create-payment
// tests with injected near-zero delays; this file mocks the hook entirely so the post-submission UI
// states (exhausted-retries banner, timeout notice, server-validation copy) can be asserted without
// waiting out the real 3s confirm countdown and full-jitter backoff. Separate file because vi.mock
// hoists to the whole module — mixing it into NewPaymentPage.test.tsx would break its real flows.
vi.mock('@clearline/data-access-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clearline/data-access-payments')>();
  return { ...actual, useCreatePayment: vi.fn() };
});

const server = registerMswServer();

afterEach(() => {
  clearAccessToken();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const CONTEXT = {
  source: {
    id: 'acct_operating',
    name: 'Operating',
    maskedAccount: '••4021',
    currency: 'USD',
    availableBalance: { amountMinorUnits: 4_821_000, currency: 'USD' },
    dailyLimit: { amountMinorUnits: 2_000_000, currency: 'USD' },
    dailySpent: { amountMinorUnits: 0, currency: 'USD' },
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
  ],
};

function renderPage() {
  setAccessToken('access_valid');
  server.use(http.get('*/api/payments/context', () => HttpResponse.json(CONTEXT)));
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

function mockCreatePayment(overrides: Parameters<typeof buildMutationResult>[0]) {
  vi.mocked(useCreatePayment).mockReturnValue(
    buildMutationResult(overrides) as unknown as ReturnType<typeof useCreatePayment>,
  );
}

describe('NewPaymentPage — exhausted retries (US-CW-007 AC-04)', () => {
  it('shows a persistent Retry banner that re-submits the payment', async () => {
    const mutate = vi.fn();
    mockCreatePayment({ mutate, isError: true, error: new Error('payment_failed') });
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText("Couldn't process this payment. Try again.")).toBeInTheDocument();

    await userEvent.setup().click(retry);
    expect(mutate).toHaveBeenCalled();
  });
});

describe('NewPaymentPage — timeout (US-CW-007 AC-03)', () => {
  it('tells the user we are still confirming and not to resubmit', async () => {
    mockCreatePayment({ isError: true, error: new PaymentTimeoutError() });
    renderPage();

    expect(
      await screen.findByText(
        "We're still confirming your payment. We'll update this in a moment — don't resubmit.",
      ),
    ).toBeInTheDocument();
    // Submit is blocked while confirmation is indeterminate.
    expect(screen.getByRole('button', { name: /review & send/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('NewPaymentPage — server-rejected recipient (US-CW-008 AC-03)', () => {
  it('maps a server recipient_not_found to the neutral inline copy', async () => {
    mockCreatePayment({ isError: true, error: new PaymentValidationError('recipient_not_found') });
    renderPage();

    expect(
      await screen.findByText(
        "We couldn't find that recipient account. Check the details and try again.",
      ),
    ).toBeInTheDocument();
  });
});
