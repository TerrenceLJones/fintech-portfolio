import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type {
  CardProgramDefaultsResponse,
  UpdateCardProgramDefaultsRequest,
} from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { CardProgramPage } from './CardProgramPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function seedProgram(
  overrides: Partial<CardProgramDefaultsResponse> = {},
): CardProgramDefaultsResponse {
  return {
    defaultMonthlyLimit: { amountMinorUnits: 200_000, currency: 'USD' },
    defaultPerTransactionLimit: { amountMinorUnits: 50_000, currency: 'USD' },
    defaultAllowedMccs: ['software', 'office_supplies'],
    issuancePolicy: 'everyone',
    merchantCategories: [
      { code: 'software', mcc: '5734', label: 'Software & Cloud Services' },
      { code: 'office_supplies', mcc: '5943', label: 'Office Supplies' },
      { code: 'travel', mcc: '4722', label: 'Travel & Airlines' },
    ],
    currency: 'USD',
    ...overrides,
  };
}

function mockBackend(initial = seedProgram(), { authorized = true } = {}) {
  setAccessToken('access_valid');
  const state = { program: initial };
  server.use(
    http.get('*/api/settings/sections/:slug', ({ params }) =>
      authorized
        ? HttpResponse.json({ slug: params.slug, authorized: true })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.get('*/api/card-program', () => HttpResponse.json(state.program)),
    http.patch('*/api/card-program', async ({ request }) => {
      const patch = (await request.json()) as UpdateCardProgramDefaultsRequest;
      state.program = {
        ...state.program,
        defaultMonthlyLimit: {
          amountMinorUnits: patch.defaultMonthlyLimitMinorUnits,
          currency: 'USD',
        },
        defaultPerTransactionLimit: {
          amountMinorUnits: patch.defaultPerTransactionLimitMinorUnits,
          currency: 'USD',
        },
        defaultAllowedMccs: patch.defaultAllowedMccs,
        issuancePolicy: patch.issuancePolicy,
      };
      return HttpResponse.json(state.program);
    }),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/card-program']}>
          <CardProgramPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

const footer = () => screen.queryByRole('region', { name: 'Unsaved changes' });

describe('CardProgramPage — default limits (AC-01)', () => {
  it('prefills the saved limits and states existing cards are unaffected', async () => {
    mockBackend();
    renderPage();
    const monthly = await screen.findByLabelText('Default monthly limit');
    expect(monthly).toHaveValue('2000');
    expect(screen.getByText(/Existing cards are not affected/i)).toBeInTheDocument();
  });

  it('saves an edited monthly limit and shows a toast', async () => {
    mockBackend();
    renderPage();
    const monthly = await screen.findByLabelText('Default monthly limit');
    await userEvent.clear(monthly);
    await userEvent.type(monthly, '3000');
    expect(footer()).toBeInTheDocument();
    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('Card program updated')).toBeInTheDocument());
  });
});

describe('CardProgramPage — searchable MCC restrictions (AC-02)', () => {
  it('filters the catalogue by numeric MCC code', async () => {
    mockBackend();
    renderPage();
    const search = await screen.findByLabelText('Search merchant categories');
    await userEvent.type(search, '4722');
    expect(screen.getByRole('button', { name: /Travel & Airlines/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Office Supplies/ })).not.toBeInTheDocument();
  });
});

describe('CardProgramPage — save rejected (422)', () => {
  it('shows an inline error when the server rejects the limits', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/settings/sections/:slug', ({ params }) =>
        HttpResponse.json({ slug: params.slug, authorized: true }),
      ),
      http.get('*/api/card-program', () => HttpResponse.json(seedProgram())),
      http.patch('*/api/card-program', () =>
        HttpResponse.json({ error: 'invalid_limit' }, { status: 422 }),
      ),
    );
    renderPage();
    const monthly = await screen.findByLabelText('Default monthly limit');
    await userEvent.clear(monthly);
    await userEvent.type(monthly, '3000');
    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Couldn’t save the card program/i)).toBeInTheDocument();
  });
});

describe('CardProgramPage — server decides (AC-09)', () => {
  it('renders AccessDenied when the section probe returns 403', async () => {
    mockBackend(seedProgram(), { authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Default monthly limit')).not.toBeInTheDocument();
  });
});
