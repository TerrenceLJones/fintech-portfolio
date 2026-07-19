import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { Role } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AppChrome } from './AppChrome';
import { usePageTitle } from './hooks/usePageTitle';
import { withQueryClient } from './test/with-query-client';

const server = registerMswServer();

afterEach(() => clearAccessToken());

function mockRole(role: Role, isAdmin = false) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role,
        approvalLimit: role === 'finance_manager' ? 1_000_000 : null,
        currency: 'USD',
        isAdmin,
      }),
    ),
  );
}

function renderChrome(initialEntry = '/', home: ReactNode = <div>Home content</div>) {
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<AppChrome />}>
              <Route path="/" element={home} />
              <Route path="/expenses" element={<div>My Expenses content</div>} />
              <Route path="/approvals" element={<div>Approvals content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ),
  );
}

describe('AppChrome role-scoped navigation', () => {
  it('shows only My Expenses and My Cards for an Employee (AC-01)', async () => {
    mockRole('employee');
    renderChrome();

    // "My Cards" is a nav-only label (unlike "My Expenses", which is also the page title), so it's
    // an unambiguous signal that the role-scoped nav has populated.
    await waitFor(() => expect(screen.getByText('My Cards')).toBeInTheDocument());
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconciliation')).not.toBeInTheDocument();
  });

  it('adds Approvals and Reconciliation for a Finance Manager (AC-02)', async () => {
    mockRole('finance_manager');
    renderChrome();

    await waitFor(() => expect(screen.getByText('Approvals')).toBeInTheDocument());
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    expect(screen.queryByText('Budget Management')).not.toBeInTheDocument();
  });

  it('adds Budget Management and Audit Log for a Controller (AC-03)', async () => {
    mockRole('controller');
    renderChrome();

    await waitFor(() => expect(screen.getByText('Budget Management')).toBeInTheDocument());
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('does not show a primary-nav Team item for an Admin — Team moved into Settings (US-CW-033)', async () => {
    mockRole('employee', true);
    renderChrome();

    // Settings is universal, so its presence signals the role-scoped nav has populated.
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    // Team & Members now lives under Settings, not the primary rail; orthogonality still holds.
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
  });
});

describe('AppChrome identity footer', () => {
  it('shows the name, role and compact approval limit for a Finance Manager (AC-04)', async () => {
    mockRole('finance_manager');
    renderChrome();

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('Finance Manager · $10k limit')).toBeInTheDocument(),
    );
  });

  it('shows just the role for an Employee with no approval authority', async () => {
    mockRole('employee');
    renderChrome();

    await waitFor(() => expect(screen.getByText('Marcus Okafor')).toBeInTheDocument());
    expect(screen.getByText('Employee')).toBeInTheDocument();
  });

  it('shows Unlimited for a Controller', async () => {
    mockRole('controller');
    renderChrome();

    await waitFor(() => expect(screen.getByText('Controller · Unlimited')).toBeInTheDocument());
  });
});

function TitledHome() {
  usePageTitle('Spend Analytics');
  return <div>Home content</div>;
}

describe('AppChrome page title', () => {
  it('defaults the heading and browser tab to the active section nav label', async () => {
    mockRole('employee');
    renderChrome('/expenses');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'My Expenses' })).toBeInTheDocument(),
    );
    expect(document.title).toBe('My Expenses · Clearline');
  });

  it('lets a page override the heading and tab via usePageTitle', async () => {
    mockRole('employee');
    renderChrome('/', <TitledHome />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Spend Analytics' })).toBeInTheDocument(),
    );
    expect(document.title).toBe('Spend Analytics · Clearline');
    // The nav label is not used as the heading while a page overrides it.
    expect(screen.queryByRole('heading', { name: 'My Expenses' })).not.toBeInTheDocument();
  });

  it('falls back to the nav label once the overriding page unmounts (navigates away)', async () => {
    mockRole('finance_manager');
    renderChrome('/', <TitledHome />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Spend Analytics' })).toBeInTheDocument(),
    );

    // Navigating to Approvals unmounts TitledHome, clearing its override; the heading and tab return
    // to the new section's nav label rather than sticking on the prior page's title. Wait for the
    // session-driven nav to populate, and target the nav *button* (not the heading, which also reads
    // "Approvals" post-navigation).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approvals' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approvals' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument(),
    );
    expect(document.title).toBe('Approvals · Clearline');
  });
});
