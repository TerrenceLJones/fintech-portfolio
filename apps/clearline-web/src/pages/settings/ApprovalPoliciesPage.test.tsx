import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ApprovalPolicyResponse, UpdateApprovalPolicyRequest } from '@clearline/contracts';
import { validateApprovalTiers } from '@clearline/domain-expenses';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ApprovalPoliciesPage } from './ApprovalPoliciesPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

/** A non-default three-tier ladder so "reset to defaults" is observably a change. */
function seedPolicy(): ApprovalPolicyResponse {
  return {
    currency: 'USD',
    tiers: [
      { id: 't0', minMinorUnits: 0, maxMinorUnits: 99_999, approver: 'auto' },
      { id: 't1', minMinorUnits: 100_000, maxMinorUnits: 5_000_000, approver: 'finance_manager' },
      { id: 't2', minMinorUnits: 5_000_001, maxMinorUnits: null, approver: 'controller' },
    ],
  };
}

function mockBackend(initial = seedPolicy(), { authorized = true } = {}) {
  setAccessToken('access_valid');
  const state = { policy: initial };
  server.use(
    http.get('*/api/settings/sections/:slug', ({ params }) =>
      authorized
        ? HttpResponse.json({ slug: params.slug, authorized: true })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.get('*/api/approval-policy', () => HttpResponse.json(state.policy)),
    http.patch('*/api/approval-policy', async ({ request }) => {
      const patch = (await request.json()) as UpdateApprovalPolicyRequest;
      const validation = validateApprovalTiers(patch.tiers.map((t, i) => ({ id: `s${i}`, ...t })));
      if (!validation.ok) {
        return HttpResponse.json(
          { error: 'incoherent_policy', issues: ['overlap'] },
          { status: 422 },
        );
      }
      state.policy = { currency: 'USD', tiers: validation.tiers };
      return HttpResponse.json(state.policy);
    }),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/approval-policies']}>
          <ApprovalPoliciesPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

const footer = () => screen.queryByRole('region', { name: 'Unsaved changes' });

describe('ApprovalPoliciesPage — the ladder (AC-01)', () => {
  it('renders one row per tier with its approver level', async () => {
    mockBackend();
    renderPage();
    expect(await screen.findByText('Auto-approve')).toBeInTheDocument();
    expect(screen.getByText('Finance Manager')).toBeInTheDocument();
    expect(screen.getByText('Controller')).toBeInTheDocument();
  });
});

describe('ApprovalPoliciesPage — server decides (AC-09)', () => {
  it('renders AccessDenied when the section probe returns 403', async () => {
    mockBackend(seedPolicy(), { authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
    expect(screen.queryByText('Finance Manager')).not.toBeInTheDocument();
  });
});

describe('ApprovalPoliciesPage — reset to defaults (AC-05)', () => {
  it('confirms, restores the default ladder, and saves', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Auto-approve');

    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/default ladder/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset to defaults' }));

    // The default ladder has no auto-approve tier, and the change makes the page dirty.
    await waitFor(() => expect(screen.queryByText('Auto-approve')).not.toBeInTheDocument());
    expect(footer()).toBeInTheDocument();

    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('Approval policy updated')).toBeInTheDocument());
  });
});

describe('ApprovalPoliciesPage — gap/overlap guard (AC-03)', () => {
  it('surfaces the overlap message and blocks the row save', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Auto-approve');

    // A new tier defaults to an unlimited range that overlaps the existing top tier.
    await userEvent.click(screen.getByRole('button', { name: '+ Add tier' }));
    expect(await screen.findByText(/overlaps with an existing tier/i)).toBeInTheDocument();

    // The inline Save (distinct from the footer's "Save changes") is disabled while incoherent.
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
  });
});
