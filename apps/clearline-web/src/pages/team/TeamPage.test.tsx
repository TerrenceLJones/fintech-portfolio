import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { TeamPage } from './TeamPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const ROSTER = {
  organizationId: 'org_1',
  organizationName: 'Northwind Labs, Inc.',
  members: [
    {
      id: 'user_owner',
      displayName: 'Priya Nair',
      email: 'priya@northwind.test',
      role: 'controller',
      isAdmin: false,
      isOwner: true,
      joinedAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'user_2',
      displayName: 'Dara Reyes',
      email: 'dara@northwind.test',
      role: 'employee',
      isAdmin: false,
      isOwner: false,
      joinedAt: '2026-05-18T00:00:00.000Z',
    },
  ],
  invites: [
    {
      id: 'invite_1',
      email: 'pending@northwind.test',
      role: 'finance_manager',
      grantAdmin: false,
      invitedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
};

/** Stub the session so useAuthorization resolves; `isOwner` gates the Admin-revoke UI (AC-08). */
function mockSession(isOwner: boolean) {
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_owner',
        email: 'priya@northwind.test',
        displayName: 'Priya Nair',
        role: 'controller',
        approvalLimit: null,
        currency: 'USD',
        isAdmin: false,
        isOwner,
      }),
    ),
  );
}

function mockRoster({ isOwner = true }: { isOwner?: boolean } = {}) {
  setAccessToken('access_valid');
  mockSession(isOwner);
  server.use(http.get('*/api/team/members', () => HttpResponse.json(ROSTER)));
}

function renderPage() {
  return render(
    withQueryClient(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    ),
  );
}

describe('TeamPage', () => {
  it('renders the roster with members and a pending invite', async () => {
    mockRoster();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    expect(screen.getByText('Dara Reyes')).toBeInTheDocument();
    expect(screen.getByText('pending@northwind.test')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(/2 members · 1 pending invite · Northwind Labs/)).toBeInTheDocument();
  });

  it('offers no Remove action for the Owner, but explains why (US-CW-030 AC-03)', async () => {
    mockRoster();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    expect(screen.getByText(/Owner can’t be removed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Priya Nair/ })).not.toBeInTheDocument();
    // A regular member does get the remove action.
    expect(screen.getByRole('button', { name: /Remove Dara Reyes/ })).toBeInTheDocument();
  });

  it('opens the invite modal from the Invite teammate button', async () => {
    mockRoster();
    renderPage();

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Invite teammate' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Invite a teammate')).toBeInTheDocument();
    expect(within(dialog).getByText('Also grant Admin')).toBeInTheDocument();
  });

  it('exposes an Admin toggle in the change-role dialog (US-CW-031 AC-08)', async () => {
    mockRoster();
    renderPage();

    await waitFor(() => expect(screen.getByText('Dara Reyes')).toBeInTheDocument());
    // Dara is the only non-owner member, so there's exactly one Change role action.
    await userEvent.click(screen.getByRole('button', { name: 'Change role' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Admin')).toBeInTheDocument();
    // Dara isn't an Admin, so the toggle is available to grant it.
    expect(within(dialog).getByRole('checkbox')).toBeEnabled();
  });

  it('offers Resend and Revoke actions on a pending invite (US-CW-031 AC-09/AC-10)', async () => {
    mockRoster();
    renderPage();

    await waitFor(() => expect(screen.getByText('pending@northwind.test')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Revoke invite for pending@northwind.test/ }),
    ).toBeInTheDocument();
  });

  it('resends a pending invite (US-CW-031 AC-09)', async () => {
    mockRoster();
    let resentId: string | undefined;
    server.use(
      http.post('*/api/team/invites/:id/resend', ({ params }) => {
        resentId = String(params.id);
        return HttpResponse.json({});
      }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('pending@northwind.test')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(resentId).toBe('invite_1'));
    // A resend has no other visible effect on the row, so it confirms with a toast.
    expect(await screen.findByText('Invite resent')).toBeInTheDocument();
  });

  it('revokes a pending invite after confirmation (US-CW-031 AC-10)', async () => {
    mockRoster();
    let revokedId: string | undefined;
    server.use(
      http.delete('*/api/team/invites/:id', ({ params }) => {
        revokedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('pending@northwind.test')).toBeInTheDocument());
    await userEvent.click(
      screen.getByRole('button', { name: /Revoke invite for pending@northwind.test/ }),
    );

    // Revoking is a confirmed action, like member removal.
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke invite' }));

    await waitFor(() => expect(revokedId).toBe('invite_1'));
  });

  it('shows the access-denied surface when the roster returns 403 (AC-07)', async () => {
    setAccessToken('access_valid');
    mockSession(false);
    server.use(
      http.get('*/api/team/members', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/Team management is available to Owners and Admins/),
      ).toBeInTheDocument(),
    );
  });
});
