import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { NewPaymentPage } from './NewPaymentPage';

// This is a wiring test: it drives the real page/form/modal against focused endpoint stubs. The full
// reserve/verify/resend/lockout backend logic is covered in the mock-backend suite; here we only assert
// that a `requires_action` response opens the challenge, a correct code navigates, and an abandonment
// surfaces the retry banner (US-CW-010 AC-01/AC-02/AC-03).
const server = registerMswServer();

const context = {
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

const intentBase = {
  amount: { amountMinorUnits: 1_200_000, currency: 'USD' },
  recipientName: 'Acme Corp',
  recipientMasked: '••4188',
  method: 'ach',
  createdDate: '2026-07-08T00:00:00.000Z',
};

const challenge = { intentId: 'pi_step', method: 'otp_sms', destinationMasked: '•••-•••-4417' };

beforeEach(() => {
  server.use(
    http.get('*/api/payments/context', () => HttpResponse.json(context)),
    http.post('*/api/payments', async ({ request }) => {
      const body = (await request.json()) as { amount: { amountMinorUnits: number } };
      if (body.amount.amountMinorUnits > 1_000_000) {
        return HttpResponse.json({
          intent: { ...intentBase, id: 'pi_step', status: 'requires_action' },
          challenge,
        });
      }
      return HttpResponse.json({ intent: { ...intentBase, id: 'pi_ok', status: 'pending' } });
    }),
    http.post('*/api/payments/:id/challenge/verify', async ({ request, params }) => {
      const { code } = (await request.json()) as { code: string };
      if (code === '424242') {
        return HttpResponse.json({
          intent: { ...intentBase, id: String(params.id), status: 'pending' },
        });
      }
      if (code === '000000') {
        return HttpResponse.json(
          { error: 'otp_expired', challenge: { ...challenge, intentId: String(params.id) } },
          { status: 422 },
        );
      }
      return HttpResponse.json({ error: 'otp_incorrect' }, { status: 422 });
    }),
  );
});

afterEach(() => {
  clearAccessToken();
  sessionStorage.clear();
});

function renderPage() {
  setAccessToken('access_valid');
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

/** Fills the form for `amount` and clears the irreversible confirm dialog to actually submit. */
async function submitPayment(amount: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Acme Corp/i }));
  await user.type(screen.getByLabelText('Amount'), amount);
  await user.click(screen.getByRole('button', { name: /review & send/i }));
  // The confirm button is disabled for a 3-second countdown, then reads "Send payment".
  const send = await screen.findByRole('button', { name: /^send payment$/i }, { timeout: 4000 });
  await user.click(send);
  return user;
}

describe('NewPaymentPage — step-up challenge (US-CW-010)', () => {
  it('presents a step-up challenge for a payment over the threshold (AC-01)', async () => {
    renderPage();
    await submitPayment('12000');

    expect(await screen.findByRole('heading', { name: /verify it's you/i })).toBeInTheDocument();
    expect(screen.getByText(/required for transfers over \$10,000\.00/i)).toBeInTheDocument();
    expect(screen.queryByText('Status stub')).not.toBeInTheDocument();
  }, 10000);

  it('does NOT challenge a payment exactly at the threshold (boundary)', async () => {
    renderPage();
    await submitPayment('10000');

    expect(await screen.findByText('Status stub')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /verify it's you/i })).not.toBeInTheDocument();
  }, 10000);

  it('commits and navigates when the correct code is entered (AC-02)', async () => {
    renderPage();
    const user = await submitPayment('12000');
    await screen.findByRole('heading', { name: /verify it's you/i });

    await user.click(screen.getByLabelText('Code digit 1'));
    await user.keyboard('424242');

    expect(await screen.findByText('Status stub')).toBeInTheDocument();
  }, 10000);

  it('shows the wrong-code message without committing (AC-04)', async () => {
    renderPage();
    const user = await submitPayment('12000');
    await screen.findByRole('heading', { name: /verify it's you/i });

    await user.click(screen.getByLabelText('Code digit 1'));
    await user.keyboard('111111');

    expect(
      await screen.findByText(
        "We couldn't verify your identity. Try again or use a different verification method.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Status stub')).not.toBeInTheDocument();
  }, 10000);

  it('re-issues on an expired code with distinct copy (AC-06)', async () => {
    renderPage();
    const user = await submitPayment('12000');
    await screen.findByRole('heading', { name: /verify it's you/i });

    await user.click(screen.getByLabelText('Code digit 1'));
    await user.keyboard('000000');

    expect(await screen.findByText("That code expired. We've sent a new one.")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't verify your identity/i)).not.toBeInTheDocument();
  }, 10000);

  it('abandoning the challenge shows the banner and Retry reopens it (AC-03)', async () => {
    renderPage();
    const user = await submitPayment('12000');
    await screen.findByRole('heading', { name: /verify it's you/i });

    await user.keyboard('{Escape}');

    expect(
      await screen.findByText("Authentication wasn't completed. Try again to finish your payment."),
    ).toBeInTheDocument();
    expect(screen.getByText(/same key .*preserved/i)).toBeInTheDocument();
    expect(screen.queryByText('Status stub')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry verification/i }));
    expect(await screen.findByRole('heading', { name: /verify it's you/i })).toBeInTheDocument();
  }, 10000);
});
