import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { getAccessToken, setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { RequireOnboarded } from './RequireOnboarded';

const server = registerMswServer();

function statusResponse(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'business_1',
    status: 'approved',
    currentStep: 'review',
    lastCompletedStep: 'review',
    business: null,
    owners: [],
    documents: [],
    documentAttemptCount: 0,
    lastActivityAt: 0,
    sessionTimedOut: false,
    ...overrides,
  };
}

function renderGuard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequireOnboarded />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/onboarding/business" element={<div>Business step</div>} />
          <Route path="/onboarding/owners" element={<div>Owners step</div>} />
          <Route path="/onboarding/status" element={<div>Status page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireOnboarded', () => {
  afterEach(() => clearAccessToken());

  it('renders the app for an approved user', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderGuard();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  // US-CW-005 AC-05: a pending review must not block non-financial areas of the product.
  it('renders the app for an under_review user', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'under_review' })),
      ),
    );
    renderGuard();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('redirects an in_progress user to their current wizard step (AC-09)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'in_progress', currentStep: 'owners' })),
      ),
    );
    renderGuard();

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
  });

  it('redirects a documents_blocked user to the status page', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'documents_blocked' })),
      ),
    );
    renderGuard();

    await waitFor(() => expect(screen.getByText('Status page')).toBeInTheDocument());
  });

  it('renders nothing while the status check is pending', () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => new Promise(() => {})));
    renderGuard();

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Owners step')).not.toBeInTheDocument();
  });

  it('renders nothing (defers to the session redirect) when the status check fails a session-ending 401', async () => {
    setAccessToken('access_valid');
    // A session-ending error code makes authenticatedFetch clear the token and raise the /login
    // redirect — the guard must not paint a "connection problem" retry over that.
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json({ error: 'session_revoked_security' }, { status: 401 }),
      ),
    );
    renderGuard();

    await waitFor(() => {
      expect(getAccessToken()).toBeNull();
      expect(screen.queryByText(/connection problem/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows a retry option on a network error rather than redirecting', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderGuard();

    await waitFor(() => expect(screen.getByText(/connection problem/i)).toBeInTheDocument());

    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });
});
