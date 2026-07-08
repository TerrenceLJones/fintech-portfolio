import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { getAccessToken, setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { OnboardingProgressBoundary } from './OnboardingProgressBoundary';

const server = registerMswServer();

function statusResponse(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'business_1',
    status: 'in_progress',
    currentStep: 'owners',
    lastCompletedStep: 'business',
    business: null,
    owners: [],
    documents: [],
    documentAttemptCount: 0,
    lastActivityAt: 0,
    sessionTimedOut: false,
    ...overrides,
  };
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<OnboardingProgressBoundary />}>
            <Route path="/onboarding/business" element={<div>Business step</div>} />
            <Route path="/onboarding/owners" element={<div>Owners step</div>} />
            <Route path="/onboarding/documents" element={<div>Documents step</div>} />
            <Route path="/onboarding/review" element={<div>Review step</div>} />
          </Route>
          <Route path="/onboarding/status" element={<div>Status page</div>} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingProgressBoundary', () => {
  afterEach(() => clearAccessToken());

  it('renders the matching step when the URL matches currentStep', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderAt('/onboarding/owners');

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
  });

  it('redirects to the canonical currentStep when the URL is ahead of it', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderAt('/onboarding/review');

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
  });

  it('redirects an approved user to the dashboard rather than back into the wizard (AC-10)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'approved' })),
      ),
    );
    renderAt('/onboarding/owners');

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('redirects an under_review user to the status page (AC-11)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'under_review' })),
      ),
    );
    renderAt('/onboarding/owners');

    await waitFor(() => expect(screen.getByText('Status page')).toBeInTheDocument());
  });

  it('redirects a documents_blocked user to the status page', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'documents_blocked' })),
      ),
    );
    renderAt('/onboarding/owners');

    await waitFor(() => expect(screen.getByText('Status page')).toBeInTheDocument());
  });

  it('shows the AC-06 timeout message once redirected back to the last-completed step', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ sessionTimedOut: true })),
      ),
    );
    renderAt('/onboarding/review');

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
    expect(
      screen.getByText(
        "Your verification session timed out. Let's start again from where you left off.",
      ),
    ).toBeInTheDocument();
  });

  it('renders nothing (defers to the session redirect) when the status check fails a session-ending 401', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json({ error: 'session_revoked_security' }, { status: 401 }),
      ),
    );
    renderAt('/onboarding/owners');

    await waitFor(() => {
      expect(getAccessToken()).toBeNull();
      expect(screen.queryByText(/connection problem/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Owners step')).not.toBeInTheDocument();
  });

  it('shows a retry option on a network error rather than redirecting', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderAt('/onboarding/owners');

    await waitFor(() => expect(screen.getByText(/connection problem/i)).toBeInTheDocument());

    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
  });
});
