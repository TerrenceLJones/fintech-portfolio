import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { ApprovalsPage } from './ApprovalsPage';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();

afterEach(() => clearAccessToken());

const QUEUE = [
  {
    id: 'exp_4201',
    submitterId: 'user_201',
    submitterName: 'Priya Nair',
    category: 'Software',
    amount: { amountMinorUnits: 420_000, currency: 'USD' },
    submittedDate: '2026-06-28',
    status: 'pending_l1',
  },
  {
    id: 'exp_4471',
    submitterId: 'user_203',
    submitterName: 'Tom Becker',
    category: 'Equipment',
    amount: { amountMinorUnits: 1_500_000, currency: 'USD' },
    submittedDate: '2026-06-27',
    status: 'pending_l1',
  },
  {
    id: 'exp_4460',
    submitterId: 'user_1',
    submitterName: 'Marcus Okafor',
    category: 'Meals',
    amount: { amountMinorUnits: 18_000, currency: 'USD' },
    submittedDate: '2026-06-26',
    status: 'pending_l1',
  },
];

function mockFinanceManager() {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role: 'finance_manager',
        approvalLimit: 1_000_000,
        isAdmin: false,
        isOwner: false,
      }),
    ),
    http.get('*/api/approvals', () => HttpResponse.json({ items: QUEUE })),
  );
}

function renderPage() {
  return render(
    withQueryClient(
      <ApprovalsPage />,
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    ),
  );
}

describe('ApprovalsPage', () => {
  it('blocks an over-limit approval with the limit message and offers Escalate (AC-06)', async () => {
    mockFinanceManager();
    renderPage();

    await waitFor(() => expect(screen.getByText('Tom Becker')).toBeInTheDocument());
    expect(
      screen.getByText(
        /This exceeds your approval limit of \$10,000\.00\. Route it to a Controller/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escalate to Controller' })).toBeInTheDocument();
  });

  it('blocks self-approval with the separation-of-duties message and offers Reassign (AC-07/AC-08)', async () => {
    mockFinanceManager();
    renderPage();

    await waitFor(() =>
      expect(
        // The reason now renders inline on the row (prefixed by the category), so match a substring.
        screen.getByText(/You can't approve your own expense\. It needs another approver\./),
      ).toBeInTheDocument(),
    );
    // The self-submitted row collapses to a single Reassign action — no Approve button on that row.
    const selfRow = screen.getByText('Marcus Okafor').closest('[data-approval-row]') as HTMLElement;
    expect(within(selfRow).getByRole('button', { name: 'Reassign approver' })).toBeInTheDocument();
    expect(within(selfRow).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('reassigns a self-submitted expense to another approver when Reassign is clicked (AC-08)', async () => {
    mockFinanceManager();
    let reassignedId: string | undefined;
    server.use(
      http.post('*/api/approvals/:id/reassign', ({ params }) => {
        reassignedId = String(params.id);
        return HttpResponse.json({ item: { ...QUEUE[2], status: 'pending_l1' } });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reassign approver' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Reassign approver' }));

    await waitFor(() => expect(reassignedId).toBe('exp_4460'));
  });

  it('leaves an in-limit, other-submitter expense approvable', async () => {
    mockFinanceManager();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    const priyaRow = screen.getByText('Priya Nair').closest('[data-approval-row]') as HTMLElement;
    const approve = within(priyaRow).getByRole('button', { name: 'Approve' });
    expect(approve).toBeEnabled();
  });

  it('escalates an over-limit expense to a Controller when Escalate is clicked (AC-06)', async () => {
    mockFinanceManager();
    let escalatedId: string | undefined;
    server.use(
      http.post('*/api/approvals/:id/escalate', ({ params }) => {
        escalatedId = String(params.id);
        return HttpResponse.json({
          item: { ...QUEUE[1], status: 'pending_l2', escalatedBy: 'Marcus Okafor' },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Escalate to Controller' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Escalate to Controller' }));

    await waitFor(() => expect(escalatedId).toBe('exp_4471'));
  });

  it('rejects with a required reason captured from the dialog (AC-02)', async () => {
    mockFinanceManager();
    let sentReason: string | undefined;
    server.use(
      http.post('*/api/approvals/:id/reject', async ({ request }) => {
        sentReason = ((await request.json()) as { reason: string }).reason;
        return HttpResponse.json({ item: { ...QUEUE[0] } });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    const priyaRow = screen.getByText('Priya Nair').closest('[data-approval-row]') as HTMLElement;
    await user.click(within(priyaRow).getByRole('button', { name: 'Reject' }));

    // The reject dialog requires a reason before it can be submitted.
    await user.type(await screen.findByRole('textbox'), 'Missing itemized receipt');
    await user.click(screen.getByRole('button', { name: 'Reject expense' }));

    await waitFor(() => expect(sentReason).toBe('Missing itemized receipt'));
  });

  it('reconciles a stale approval to server truth on a 409 (AC-05)', async () => {
    mockFinanceManager();
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json({ error: 'stale_action', actedBy: 'Marcus Okafor' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    const priyaRow = screen.getByText('Priya Nair').closest('[data-approval-row]') as HTMLElement;
    await user.click(within(priyaRow).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Already approved')).toBeInTheDocument();
    expect(
      screen.getByText(/This expense was already approved by Marcus Okafor/),
    ).toBeInTheDocument();
  });

  it('surfaces an inline error when an approve fails for a non-conflict reason', async () => {
    mockFinanceManager();
    server.use(
      http.post('*/api/approvals/:id/approve', () =>
        HttpResponse.json({ error: 'internal_error' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    const priyaRow = screen.getByText('Priya Nair').closest('[data-approval-row]') as HTMLElement;
    await user.click(within(priyaRow).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/Couldn't complete that action/)).toBeInTheDocument();
  });

  it('batch-approves selected items, skipping a self-submitted one with its reason (AC-06)', async () => {
    mockFinanceManager();
    server.use(
      http.post('*/api/approvals/:id/approve', ({ params }) => {
        if (params.id === 'exp_4460') {
          return HttpResponse.json({ error: 'self_approval_blocked' }, { status: 403 });
        }
        return HttpResponse.json({ item: { id: String(params.id) } });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: 'Select all expenses' }));
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));

    // Two commit, the self-submitted expense is skipped with an explanatory reason.
    expect(await screen.findByText(/2 of 3 approved/)).toBeInTheDocument();
    expect(screen.getByText('Cannot approve own expense')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is awaiting approval', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({
          userId: 'user_1',
          email: 'demo@clearline.dev',
          displayName: 'Marcus Okafor',
          role: 'finance_manager',
          approvalLimit: 1_000_000,
          isAdmin: false,
          isOwner: false,
        }),
      ),
      http.get('*/api/approvals', () => HttpResponse.json({ items: [] })),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText("You're all caught up")).toBeInTheDocument());
  });
});
