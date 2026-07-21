import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { GlMappingResponse, Integration } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { IntegrationsPage } from './IntegrationsPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const SEED: Integration[] = [
  {
    provider: 'quickbooks',
    name: 'QuickBooks Online',
    status: 'connected',
    accountEmail: 'books@acme.com',
    lastSyncAt: '2026-07-15T02:00:00.000Z',
    lastSyncOutcome: 'success',
  },
  { provider: 'xero', name: 'Xero', status: 'disconnected' },
  {
    provider: 'netsuite',
    name: 'NetSuite',
    status: 'error',
    errorMessage: 'Token expired at last sync (Jul 12).',
  },
];

const GL_MAPPING: GlMappingResponse = {
  mappings: [
    { categoryId: 'travel', categoryLabel: 'Travel', glAccountId: 'coa_6000' },
    { categoryId: 'equipment', categoryLabel: 'Equipment' },
  ],
  chartOfAccounts: [
    { id: 'coa_6000', name: 'Travel Expense', code: '6000' },
    { id: 'coa_6300', name: 'Equipment', code: '6300' },
  ],
};

function mockBackend({
  authorized = true,
  syncOutcome = 'success' as 'success' | 'partial' | 'failed',
  syncRecords = 47,
}: {
  authorized?: boolean;
  syncOutcome?: 'success' | 'partial' | 'failed';
  syncRecords?: number;
} = {}) {
  setAccessToken('access_valid');
  const state = { integrations: SEED.map((i) => ({ ...i })) };
  server.use(
    http.get('*/api/integrations', () =>
      authorized
        ? HttpResponse.json({ integrations: state.integrations })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.post('*/api/integrations/:provider/connect', ({ params }) => {
      state.integrations = state.integrations.map((i) =>
        i.provider === params.provider
          ? {
              ...i,
              status: 'connected',
              accountEmail: 'sync@example.com',
              lastSyncAt: '2026-07-21T12:00:00Z',
            }
          : i,
      );
      return HttpResponse.json(
        { integration: state.integrations.find((i) => i.provider === params.provider) },
        { status: 201 },
      );
    }),
    http.post('*/api/integrations/:provider/sync', ({ params }) => {
      const integration = state.integrations.find((i) => i.provider === params.provider)!;
      return HttpResponse.json({ integration, recordsSynced: syncRecords, outcome: syncOutcome });
    }),
    http.post('*/api/integrations/:provider/disconnect', ({ params }) => {
      state.integrations = state.integrations.map((i) =>
        i.provider === params.provider
          ? { ...i, status: 'disconnected', accountEmail: undefined }
          : i,
      );
      return HttpResponse.json({
        integration: state.integrations.find((i) => i.provider === params.provider),
      });
    }),
    http.get('*/api/integrations/:provider/gl-mapping', () => HttpResponse.json(GL_MAPPING)),
    http.put('*/api/integrations/:provider/gl-mapping', ({ params }) =>
      HttpResponse.json({
        integration: state.integrations.find((i) => i.provider === params.provider),
      }),
    ),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/integrations']}>
          <IntegrationsPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

describe('IntegrationsPage — listing (AC-01/04)', () => {
  it('renders a card per provider with its status as text', async () => {
    mockBackend();
    renderPage();
    expect(await screen.findByText('QuickBooks Online')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Token expired at last sync/)).toBeInTheDocument();
  });
});

describe('IntegrationsPage — sync now (AC-03)', () => {
  it('toasts the exported record count on a successful sync', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('QuickBooks Online');
    await userEvent.click(screen.getAllByRole('button', { name: 'Sync now' })[0]!);
    await waitFor(() =>
      expect(
        screen.getByText(/Sync complete — 47 transactions exported to QuickBooks Online/),
      ).toBeInTheDocument(),
    );
  });

  it('toasts a Partial run without claiming completeness', async () => {
    mockBackend({ syncOutcome: 'partial', syncRecords: 41 });
    renderPage();
    await screen.findByText('QuickBooks Online');
    await userEvent.click(screen.getAllByRole('button', { name: 'Sync now' })[0]!);
    await waitFor(() =>
      expect(
        screen.getByText(
          /Partial sync — 41 transactions exported to QuickBooks Online; unmapped categories were skipped\./,
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Sync complete/)).not.toBeInTheDocument();
  });
});

describe('IntegrationsPage — GL mapping (AC-02)', () => {
  it('flags an unmapped category as Not mapped', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('QuickBooks Online');
    await userEvent.click(screen.getByRole('button', { name: 'Configure GL mapping' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Not mapped')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 category not mapped/)).toBeInTheDocument();
  });

  it('discards abandoned edits when the same provider is reopened after Cancel', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('QuickBooks Online');
    await userEvent.click(screen.getByRole('button', { name: 'Configure GL mapping' }));
    let dialog = await screen.findByRole('dialog');
    // Map the unmapped Equipment row, then cancel without saving.
    await userEvent.click(within(dialog).getByLabelText('GL account for Equipment'));
    await userEvent.click(await screen.findByRole('option', { name: /Equipment/ }));
    expect(within(dialog).getByText(/All categories mapped/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // Reopen the same provider — the abandoned edit is gone; Equipment is unmapped again.
    await userEvent.click(screen.getByRole('button', { name: 'Configure GL mapping' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 category not mapped/)).toBeInTheDocument();
  });
});

describe('IntegrationsPage — disconnect names the provider (AC-06)', () => {
  it('confirms with the provider name and mapping-preserved copy', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('QuickBooks Online');
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Disconnect QuickBooks Online?')).toBeInTheDocument();
    expect(within(dialog).getByText(/GL code mappings are preserved/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(screen.getByText(/Disconnected QuickBooks Online/)).toBeInTheDocument(),
    );
  });
});

describe('IntegrationsPage — OAuth connect (AC-01)', () => {
  it('connects a disconnected provider through the authorize step', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Xero');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Authorize Xero/ }));
    await waitFor(() => expect(screen.getByText(/Connected Xero/)).toBeInTheDocument());
  });
});

describe('IntegrationsPage — server decides (AC-09)', () => {
  it('renders AccessDenied on an independent 403', async () => {
    mockBackend({ authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
  });
});
