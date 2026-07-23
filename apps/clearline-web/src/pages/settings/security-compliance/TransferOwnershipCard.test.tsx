import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { TeamMember, TeamRosterResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { TransferOwnershipCard } from './TransferOwnershipCard';
import { withQueryClient } from '../../../test/with-query-client';

// Radix Select needs these DOM APIs that happy-dom doesn't implement — polyfill them so the member
// picker can be opened in tests, matching the standard Radix-in-jsdom recipe.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

const server = registerMswServer();
afterEach(() => clearAccessToken());

function member(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: 'user_x',
    displayName: 'Sofia Whitman',
    email: 'sofia@clearline.dev',
    role: 'controller',
    isAdmin: true,
    isOwner: false,
    joinedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockBackend({
  members = [
    member({ id: 'user_owner', displayName: 'Priya Nair', isOwner: true }),
    member({ id: 'user_3', displayName: 'Sofia Whitman' }),
  ],
  twoFactorEnabled = false,
  transfer = () => HttpResponse.json({ newOwner: members[1], formerOwner: members[0] }),
}: {
  members?: TeamMember[];
  twoFactorEnabled?: boolean;
  transfer?: () => Response;
} = {}) {
  setAccessToken('access_valid');
  const roster: TeamRosterResponse = {
    organizationId: 'org_1',
    organizationName: 'Clearline Demo Co',
    members,
    invites: [],
  };
  server.use(
    http.get('*/api/team/members', () => HttpResponse.json(roster)),
    http.get('*/api/security/two-factor', () =>
      HttpResponse.json({ enabled: twoFactorEnabled, orgEnforced: false }),
    ),
    http.post('*/api/team/owner-transfer', transfer),
  );
}

function renderCard(onToast = vi.fn()) {
  render(withQueryClient(<TransferOwnershipCard onToast={onToast} />));
  return onToast;
}

async function pickMember(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('combobox', { name: 'New owner' }));
  await user.click(await screen.findByRole('option', { name }));
}

describe('TransferOwnershipCard (US-CW-043)', () => {
  it('offers only existing members as targets, never a free-text field (AC-01)', async () => {
    const user = userEvent.setup();
    mockBackend();
    renderCard();

    await user.click(await screen.findByRole('combobox', { name: 'New owner' }));
    // The Owner (self) is never offered; another member is.
    expect(await screen.findByRole('option', { name: /Sofia Whitman/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Priya Nair/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the only-member empty state when there is no eligible target', async () => {
    mockBackend({
      members: [member({ id: 'user_owner', displayName: 'Priya Nair', isOwner: true })],
    });
    renderCard();
    expect(await screen.findByText(/only member/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'New owner' })).not.toBeInTheDocument();
  });

  it('names the specific consequence in the confirmation before any transfer (AC-03)', async () => {
    const user = userEvent.setup();
    mockBackend();
    renderCard();

    await pickMember(user, /Sofia Whitman/);
    await user.click(screen.getByRole('button', { name: 'Transfer ownership…' }));
    expect(await screen.findByText('Transfer ownership to Sofia Whitman?')).toBeInTheDocument();
    // The Alert spells out the specific, named consequence (§19.9), not a bare "Are you sure?".
    expect(
      screen.getByText(/full, non-removable control of this organization/),
    ).toBeInTheDocument();
  });

  it('keeps the transfer disabled until the password is entered (AC-04)', async () => {
    const user = userEvent.setup();
    mockBackend();
    renderCard();

    await pickMember(user, /Sofia Whitman/);
    await user.click(screen.getByRole('button', { name: 'Transfer ownership…' }));
    const confirm = await screen.findByRole('button', { name: 'Transfer ownership' });
    // The Button atom gates via aria-disabled (staying focusable), not the native disabled attribute.
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Your password'), 'my-password');
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('additionally requires a TOTP code when the Owner has 2FA enrolled (AC-04)', async () => {
    const user = userEvent.setup();
    mockBackend({ twoFactorEnabled: true });
    renderCard();

    await pickMember(user, /Sofia Whitman/);
    await user.click(screen.getByRole('button', { name: 'Transfer ownership…' }));
    await user.type(await screen.findByLabelText('Your password'), 'my-password');
    const confirm = screen.getByRole('button', { name: 'Transfer ownership' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true'); // password alone isn't enough with 2FA on
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('confirms success via a toast naming the new Owner (AC-05/AC-06)', async () => {
    const user = userEvent.setup();
    mockBackend();
    const onToast = renderCard();

    await pickMember(user, /Sofia Whitman/);
    await user.click(screen.getByRole('button', { name: 'Transfer ownership…' }));
    await user.type(await screen.findByLabelText('Your password'), 'my-password');
    await user.click(screen.getByRole('button', { name: 'Transfer ownership' }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Sofia Whitman')),
    );
  });

  it('surfaces a failed re-auth with a specific, named reason (AC-04/AC-07)', async () => {
    const user = userEvent.setup();
    mockBackend({
      transfer: () => HttpResponse.json({ error: 'reauth_failed' }, { status: 403 }),
    });
    renderCard();

    await pickMember(user, /Sofia Whitman/);
    await user.click(screen.getByRole('button', { name: 'Transfer ownership…' }));
    await user.type(await screen.findByLabelText('Your password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Transfer ownership' }));

    expect(
      await screen.findByText(/password or authenticator code was incorrect/i),
    ).toBeInTheDocument();
  });
});
