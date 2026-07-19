import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ProfileResponse } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AppChrome } from '../../AppChrome';
import { settingsRoutes } from './settings-routes';
import { withQueryClient } from '../../test/with-query-client';
import { NavigationGuardProvider } from '../../hooks/navigation-guard';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function seedProfile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    userId: 'user_1',
    displayName: 'Marcus Okafor',
    email: 'demo@clearline.dev',
    phone: '+1 (415) 555-0142',
    jobTitle: 'Finance Manager',
    avatarUrl: null,
    pendingEmail: null,
    ...overrides,
  };
}

/** Wires the session + a mutable in-memory profile so the page's fetch/mutate/refetch cycle is real. */
function mockProfileBackend(initial: ProfileResponse = seedProfile()) {
  setAccessToken('access_valid');
  const state = { profile: initial };
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: state.profile.email,
        displayName: state.profile.displayName,
        role: 'finance_manager',
        approvalLimit: 1_000_000,
        currency: 'USD',
        isAdmin: false,
        isOwner: false,
        avatarUrl: state.profile.avatarUrl,
      }),
    ),
    http.get('*/api/profile', () => HttpResponse.json(state.profile)),
    http.patch('*/api/profile', async ({ request }) => {
      const patch = (await request.json()) as Partial<ProfileResponse>;
      state.profile = { ...state.profile, ...patch };
      return HttpResponse.json(state.profile);
    }),
    http.post('*/api/profile/email-change', async ({ request }) => {
      const { newEmail } = (await request.json()) as { newEmail: string };
      if (newEmail === state.profile.email) {
        return HttpResponse.json({ error: 'same_as_current' }, { status: 422 });
      }
      state.profile = { ...state.profile, pendingEmail: newEmail };
      return HttpResponse.json({ pendingEmail: newEmail });
    }),
    http.delete('*/api/profile/email-change', () => {
      state.profile = { ...state.profile, pendingEmail: null };
      return HttpResponse.json(state.profile);
    }),
  );
  return state;
}

function renderPersonal({ withGuard = false }: { withGuard?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <Routes>
      <Route element={<AppChrome />}>{settingsRoutes()}</Route>
    </Routes>
  );
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/personal']}>
          {withGuard ? <NavigationGuardProvider>{tree}</NavigationGuardProvider> : tree}
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

const footer = () => screen.queryByRole('region', { name: 'Unsaved changes' });

describe('PersonalInfoPage — identity form (AC-01/02)', () => {
  it('saves a name edit: footer appears, then a success toast and the footer clears', async () => {
    mockProfileBackend();
    renderPersonal();

    const name = await screen.findByLabelText('Full name');
    expect(footer()).not.toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.type(name, 'Marcus O.');
    expect(footer()).toBeInTheDocument();

    await userEvent.click(within(footer()!).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('Profile updated')).toBeInTheDocument());
    await waitFor(() => expect(footer()).not.toBeInTheDocument());
  });

  it('discards edits back to the saved values and hides the footer (AC-02)', async () => {
    mockProfileBackend();
    renderPersonal();

    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Changed');
    expect(footer()).toBeInTheDocument();

    await userEvent.click(within(footer()!).getByRole('button', { name: 'Discard' }));
    expect(footer()).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Marcus Okafor');
  });

  it('warns before an in-app navigation away with unsaved changes (AC-02)', async () => {
    mockProfileBackend();
    renderPersonal({ withGuard: true });

    const name = await screen.findByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Dirty edit');

    // Clicking another SettingsNav section while dirty defers navigation behind a confirmation.
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Notifications' }));

    expect(
      await screen.findByRole('heading', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
    // Navigation was deferred: we're still on Personal Info (aria-hidden behind the modal), not
    // Notifications.
    expect(
      screen.getByRole('heading', { name: 'Personal Info', hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Notifications', hidden: true }),
    ).not.toBeInTheDocument();
  });
});

describe('PersonalInfoPage — email change (AC-03)', () => {
  it('requests a change: shows the confirmation-sent notice and a pending indicator', async () => {
    mockProfileBackend();
    renderPersonal();

    const newEmail = await screen.findByLabelText('New email');
    await userEvent.type(newEmail, 'marcus.new@clearline.dev');
    await userEvent.click(screen.getByRole('button', { name: 'Update email' }));

    await waitFor(() =>
      expect(
        screen.getByText(/We've sent a confirmation link to marcus.new@clearline.dev/),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText('Pending: marcus.new@clearline.dev')).toBeInTheDocument(),
    );
  });

  it('rejects the current address inline without sending (AC edge case)', async () => {
    mockProfileBackend();
    renderPersonal();

    const newEmail = await screen.findByLabelText('New email');
    await userEvent.type(newEmail, 'demo@clearline.dev');
    await userEvent.click(screen.getByRole('button', { name: 'Update email' }));

    await waitFor(() =>
      expect(screen.getByText("That's already your email address.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/We've sent a confirmation link/)).not.toBeInTheDocument();
  });
});

describe('PersonalInfoPage — avatar (AC-06)', () => {
  it('blocks an over-5MB file before upload with a specific message', async () => {
    mockProfileBackend();
    renderPersonal();

    const input = (await screen.findByTestId('avatar-file-input')) as HTMLInputElement;
    const bigFile = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() =>
      expect(screen.getByText('This file is too large. Maximum size is 5 MB.')).toBeInTheDocument(),
    );
  });
});
