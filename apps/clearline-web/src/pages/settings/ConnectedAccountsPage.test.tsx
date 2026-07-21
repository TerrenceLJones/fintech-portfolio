import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ConnectedAccount } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ConnectedAccountsPage } from './ConnectedAccountsPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const SEED: ConnectedAccount[] = [
  {
    id: 'acct_chase',
    institutionName: 'Chase Business',
    last4: '8291',
    method: 'plaid',
    status: 'connected',
  },
  {
    id: 'acct_novo',
    institutionName: 'Novo Business',
    last4: '6120',
    method: 'plaid',
    status: 'reconnect_required',
  },
];

function mockBackend({
  authorized = true,
  accounts = SEED,
}: { authorized?: boolean; accounts?: ConnectedAccount[] } = {}) {
  setAccessToken('access_valid');
  const state = { accounts: [...accounts] };
  server.use(
    http.get('*/api/connected-accounts', () =>
      authorized
        ? HttpResponse.json({ accounts: state.accounts })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.delete('*/api/connected-accounts/:id', ({ params }) => {
      const removed = state.accounts.find((a) => a.id === params.id)!;
      state.accounts = state.accounts.filter((a) => a.id !== params.id);
      return HttpResponse.json({ account: removed });
    }),
    http.post('*/api/connected-accounts/:id/reconnect', ({ params }) => {
      state.accounts = state.accounts.map((a) =>
        a.id === params.id ? { ...a, status: 'connected' } : a,
      );
      return HttpResponse.json({ account: state.accounts.find((a) => a.id === params.id) });
    }),
    http.post('*/api/connected-accounts/manual', async ({ request }) => {
      const { routingNumber } = (await request.json()) as { routingNumber: string };
      if (!/^\d{9}$/.test(routingNumber)) {
        return HttpResponse.json({ error: 'invalid_routing' }, { status: 422 });
      }
      const account: ConnectedAccount = {
        id: 'acct_manual',
        institutionName: 'Manual bank account',
        last4: '7890',
        method: 'manual',
        status: 'pending_verification',
        verificationAttemptsRemaining: 3,
      };
      state.accounts = [...state.accounts, account];
      return HttpResponse.json({ account }, { status: 201 });
    }),
    http.post('*/api/connected-accounts/:id/verify', async ({ request, params }) => {
      const { amountsMinorUnits } = (await request.json()) as {
        amountsMinorUnits: [number, number];
      };
      const correct = amountsMinorUnits.includes(18) && amountsMinorUnits.includes(42);
      if (correct) {
        state.accounts = state.accounts.map((a) =>
          a.id === params.id ? { ...a, status: 'connected' } : a,
        );
        return HttpResponse.json({
          account: state.accounts.find((a) => a.id === params.id),
          outcome: 'verified',
          attemptsRemaining: 0,
        });
      }
      return HttpResponse.json({
        account: state.accounts.find((a) => a.id === params.id),
        outcome: 'mismatch',
        attemptsRemaining: 2,
      });
    }),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/connected-accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

describe('ConnectedAccountsPage — listing (AC-04/08)', () => {
  it('lists accounts with masked numbers and status', async () => {
    mockBackend();
    renderPage();
    expect(await screen.findByText('Chase Business')).toBeInTheDocument();
    expect(screen.getByText(/••••8291 · Connected via Plaid/)).toBeInTheDocument();
    expect(screen.getByText('Reconnect needed')).toBeInTheDocument();
  });
});

describe('ConnectedAccountsPage — remove names the account (AC-07)', () => {
  it('confirms with the account name and consequence before removing', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Chase Business');
    // Chase is the first row, so its Remove button is the first of the two on the page.
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Remove Chase Business ••••8291\?/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/no longer be available for ACH transfers/i),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove account' }));

    await waitFor(() => expect(screen.getByText(/Removed Chase Business/)).toBeInTheDocument());
  });
});

describe('ConnectedAccountsPage — reconnect (AC-08)', () => {
  it('reconnects an account that needs re-auth', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Novo Business');
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await waitFor(() => expect(screen.getByText(/Reconnected Novo Business/)).toBeInTheDocument());
  });
});

describe('ConnectedAccountsPage — manual connect + verify (AC-05/06)', () => {
  it('connects manually then verifies with the correct micro-deposit amounts', async () => {
    mockBackend({ accounts: [] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Connect account' }));
    await userEvent.click(
      await screen.findByRole('button', { name: /Enter account details manually/ }),
    );
    await userEvent.type(screen.getByLabelText('Routing number'), '021000021');
    await userEvent.type(screen.getByLabelText('Account number'), '1234567890');
    await userEvent.click(screen.getByRole('button', { name: /Send micro-deposits/ }));

    // The pending account now shows a Verify affordance.
    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('First amount'), '0.18');
    await userEvent.type(within(dialog).getByLabelText('Second amount'), '0.42');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify account' }));
    await waitFor(() => expect(screen.getByText('Account verified')).toBeInTheDocument());
  });

  it('shows the retry copy with remaining attempts on a mismatch (AC-06)', async () => {
    mockBackend({
      accounts: [
        {
          id: 'acct_manual',
          institutionName: 'Manual bank account',
          last4: '7890',
          method: 'manual',
          status: 'pending_verification',
          verificationAttemptsRemaining: 3,
        },
      ],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('First amount'), '0.10');
    await userEvent.type(within(dialog).getByLabelText('Second amount'), '0.20');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify account' }));
    expect(await within(dialog).findByText(/Those amounts don’t match/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 attempts left/i)).toBeInTheDocument();
  });
});

describe('ConnectedAccountsPage — server decides (AC-09)', () => {
  it('renders AccessDenied on an independent 403', async () => {
    mockBackend({ authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
  });
});
