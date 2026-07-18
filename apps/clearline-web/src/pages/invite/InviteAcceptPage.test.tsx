import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken } from '@clearline/data-access-auth';
import { InviteAcceptPage } from './InviteAcceptPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderAt(token: string) {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[`/invite?token=${token}`]}>
        <InviteAcceptPage />
      </MemoryRouter>,
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    ),
  );
}

describe('InviteAcceptPage', () => {
  it('shows the set-password screen for a valid invite (US-CW-031 AC-02)', async () => {
    server.use(
      http.get('*/api/team/invites/:token', () =>
        HttpResponse.json({
          status: 'valid',
          inviterName: 'Priya Nair',
          organizationName: 'Northwind Labs, Inc.',
          role: 'finance_manager',
          email: 'newhire@northwind.test',
        }),
      ),
    );
    renderAt('invite_ok');

    await waitFor(() => expect(screen.getByText('Set a password to join')).toBeInTheDocument());
    expect(screen.getByText(/Priya Nair invited you to Northwind Labs/)).toBeInTheDocument();
    expect(screen.getByText(/Straight to your dashboard — no onboarding/)).toBeInTheDocument();
  });

  it('shows the expired screen and grants no membership for an expired invite (AC-03)', async () => {
    server.use(
      http.get('*/api/team/invites/:token', () => HttpResponse.json({ status: 'expired' })),
    );
    renderAt('invite_old');

    await waitFor(() => expect(screen.getByText('This invite has expired')).toBeInTheDocument());
    expect(screen.getByText(/Ask an admin to resend it/)).toBeInTheDocument();
    expect(screen.queryByText('Set a password to join')).not.toBeInTheDocument();
  });
});
