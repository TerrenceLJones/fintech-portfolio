import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { SpendControlsResponse, UpdateSpendControlsRequest } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { SpendControlsPage } from './SpendControlsPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function seedControls(overrides: Partial<SpendControlsResponse> = {}): SpendControlsResponse {
  return {
    receiptRequiredThresholdMinorUnits: 7_500,
    memoRequiredThresholdMinorUnits: 0,
    outOfPolicyBehavior: 'flag',
    categoryCaps: [
      { categoryId: 'meals', label: 'Meals', monthlyLimitMinorUnits: null },
      { categoryId: 'travel', label: 'Travel', monthlyLimitMinorUnits: 30_000 },
    ],
    currency: 'USD',
    ...overrides,
  };
}

function mockBackend(initial = seedControls(), { authorized = true } = {}) {
  setAccessToken('access_valid');
  const state = { controls: initial };
  server.use(
    http.get('*/api/settings/sections/:slug', ({ params }) =>
      authorized
        ? HttpResponse.json({ slug: params.slug, authorized: true })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.get('*/api/spend-controls', () => HttpResponse.json(state.controls)),
    http.patch('*/api/spend-controls', async ({ request }) => {
      const patch = (await request.json()) as UpdateSpendControlsRequest;
      state.controls = {
        ...state.controls,
        receiptRequiredThresholdMinorUnits: patch.receiptRequiredThresholdMinorUnits,
        memoRequiredThresholdMinorUnits: patch.memoRequiredThresholdMinorUnits,
        outOfPolicyBehavior: patch.outOfPolicyBehavior,
        categoryCaps: state.controls.categoryCaps.map((cap) => {
          const next = patch.categoryCaps.find((c) => c.categoryId === cap.categoryId);
          return next ? { ...cap, monthlyLimitMinorUnits: next.monthlyLimitMinorUnits } : cap;
        }),
      };
      return HttpResponse.json(state.controls);
    }),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/spend-controls']}>
          <SpendControlsPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

const footer = () => screen.queryByRole('region', { name: 'Unsaved changes' });

describe('SpendControlsPage — thresholds (AC-06)', () => {
  it('saves a memo-threshold edit and shows a toast', async () => {
    mockBackend();
    renderPage();
    const memo = await screen.findByLabelText('Memo required for expenses over');
    expect(footer()).not.toBeInTheDocument();

    await userEvent.type(memo, '200');
    expect(footer()).toBeInTheDocument();
    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('Spend controls updated')).toBeInTheDocument());
  });
});

describe('SpendControlsPage — server decides (AC-09)', () => {
  it('renders AccessDenied when the section probe returns 403', async () => {
    mockBackend(seedControls(), { authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Memo required for expenses over')).not.toBeInTheDocument();
  });
});

describe('SpendControlsPage — category caps (AC-08)', () => {
  it('restores a capped category to unlimited', async () => {
    mockBackend();
    renderPage();
    // Travel starts capped ($300) with a Restore unlimited affordance.
    const restore = await screen.findByRole('button', { name: 'Restore unlimited' });
    await userEvent.click(restore);
    expect(screen.getAllByText('Unlimited').length).toBeGreaterThanOrEqual(2);
    expect(footer()).toBeInTheDocument();
  });
});

describe('SpendControlsPage — block entirely confirms first (AC-07)', () => {
  it('confirms with the specific consequence before turning on Block entirely', async () => {
    mockBackend();
    renderPage();
    const select = await screen.findByRole('combobox', { name: 'Out-of-policy behavior' });
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Block entirely' }));

    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/will prevent any out-of-policy expense submission/i),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Block entirely' }));
    await waitFor(() => expect(screen.getByText('Spend controls updated')).toBeInTheDocument());
  });
});
