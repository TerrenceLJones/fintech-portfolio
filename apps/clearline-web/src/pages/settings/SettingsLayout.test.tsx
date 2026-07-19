import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { Role } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AppChrome } from '../../AppChrome';
import { settingsRoutes } from './settings-routes';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function mockRole(role: Role, opts: { isAdmin?: boolean; isOwner?: boolean } = {}) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role,
        approvalLimit: null,
        currency: 'USD',
        isAdmin: opts.isAdmin ?? false,
        isOwner: opts.isOwner ?? false,
      }),
    ),
    // The Organization placeholders probe this to honor the server's decision; a client-authorized
    // section resolves 200 here (the independent-403 path is unit-tested in OrgSettingsSectionPlaceholder).
    http.get('*/api/settings/sections/:slug', ({ params }) =>
      HttpResponse.json({ slug: params.slug, authorized: true }),
    ),
  );
}

function renderSettings(entry = '/settings') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route element={<AppChrome />}>{settingsRoutes()}</Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
  return { ...utils, queryClient };
}

/** The SettingsNav secondary rail (aria-label "Settings"), distinct from the primary "Main" nav. */
const settingsNav = () => screen.getByRole('navigation', { name: 'Settings' });

describe('SettingsLayout — landing & Profile group (AC-01/AC-02)', () => {
  it('lands an Employee on Personal Info by default, inside the persistent shell', async () => {
    mockRole('employee');
    renderSettings('/settings');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Personal Info' })).toBeInTheDocument(),
    );
    // Mounted inside AppShell: the "Settings" page heading is present.
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    // Profile group present with its three sections.
    expect(within(settingsNav()).getByRole('group', { name: 'Profile' })).toBeInTheDocument();
    expect(within(settingsNav()).getByRole('link', { name: 'Security' })).toBeInTheDocument();
  });

  it('does not render the Organization group for an Employee (AC-02)', async () => {
    mockRole('employee');
    renderSettings('/settings/personal');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Personal Info' })).toBeInTheDocument(),
    );
    expect(
      within(settingsNav()).queryByRole('group', { name: 'Organization' }),
    ).not.toBeInTheDocument();
    expect(
      within(settingsNav()).queryByRole('link', { name: 'Billing & Plan' }),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsLayout — Organization group for an Owner (AC-03)', () => {
  it('renders the Organization group including Admin/Owner-only sections', async () => {
    mockRole('controller', { isOwner: true });
    renderSettings('/settings/company');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Company Profile' })).toBeInTheDocument(),
    );
    expect(within(settingsNav()).getByRole('group', { name: 'Organization' })).toBeInTheDocument();
    expect(within(settingsNav()).getByRole('link', { name: 'Billing & Plan' })).toBeInTheDocument();
    // Team & Members is now an Organization settings section (relocated from the top-level /team).
    expect(within(settingsNav()).getByRole('link', { name: 'Team & Members' })).toBeInTheDocument();
  });
});

describe('SettingsLayout — deep-link refusal (AC-04)', () => {
  it('shows AccessDenied when an Employee deep-links an Organization route', async () => {
    mockRole('employee');
    renderSettings('/settings/billing');

    await waitFor(() => expect(screen.getByText(/Ask an admin/i)).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Billing & Plan' })).not.toBeInTheDocument();
  });
});

describe('SettingsLayout — section switching (AC-05)', () => {
  it('swaps the content region and deep-linkable URL without a reload', async () => {
    mockRole('controller', { isOwner: true });
    renderSettings('/settings/personal');

    // Wait for the session to load so the Organization group has populated in the nav.
    await waitFor(() =>
      expect(
        within(settingsNav()).getByRole('link', { name: 'Company Profile' }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(within(settingsNav()).getByRole('link', { name: 'Company Profile' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Company Profile' })).toBeInTheDocument(),
    );
    expect(within(settingsNav()).getByRole('link', { name: 'Company Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('SettingsLayout — unknown slug (edge case)', () => {
  it('renders the in-shell not-found for an unknown settings section', async () => {
    mockRole('controller', { isOwner: true });
    renderSettings('/settings/not-a-real-section');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Section not found' })).toBeInTheDocument(),
    );
    // The SettingsNav is still present, so the user can recover.
    expect(settingsNav()).toBeInTheDocument();
  });
});

describe('SettingsLayout — mid-session downgrade (AC-06)', () => {
  it('moves a user off a now-forbidden section to Personal Info and shows the access-changed banner', async () => {
    mockRole('controller', { isOwner: true });
    const { queryClient } = renderSettings('/settings/billing');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Billing & Plan' })).toBeInTheDocument(),
    );

    // A mid-session downgrade to Employee: re-mock the session and refetch it.
    mockRole('employee');
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Personal Info' })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Your access changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Billing & Plan' })).not.toBeInTheDocument();
  });
});
