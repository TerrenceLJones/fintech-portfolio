import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { ONBOARDING_STATUS_QUERY_KEY } from '@clearline/data-access-onboarding';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { OnboardingStatusPage } from './OnboardingStatusPage';

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/status']}>
        <Routes>
          <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
          <Route path="/" element={<div>Dashboard stub</div>} />
          <Route path="/onboarding/business" element={<div>Business step</div>} />
          <Route path="/onboarding/owners" element={<div>Owners step</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingStatusPage', () => {
  afterEach(() => clearAccessToken());

  it('redirects an in_progress user back to their current wizard step (AC-12)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'in_progress', currentStep: 'owners' })),
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('Owners step')).toBeInTheDocument());
  });

  it('waits for an in-flight refetch instead of bouncing to the wizard on stale in_progress (post-submit AC-08)', async () => {
    setAccessToken('access_valid');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Mirror the review-submit sequence: the cache still holds the pre-submission in_progress status
    // while the invalidated query refetches the now-terminal (approved) one. The page must wait, not
    // bounce back to the wizard on the stale value (which would skip the approval screen).
    queryClient.setQueryData(
      ONBOARDING_STATUS_QUERY_KEY,
      statusResponse({ status: 'in_progress', currentStep: 'review' }),
    );
    queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY });
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'approved' })),
      ),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/onboarding/status']}>
          <Routes>
            <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
            <Route path="/onboarding/business" element={<div>Business step</div>} />
            <Route path="/onboarding/review" element={<div>Review step</div>} />
            <Route path="/" element={<div>Dashboard stub</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Your account is approved')).toBeInTheDocument());
    expect(screen.queryByText('Review step')).not.toBeInTheDocument();
  });

  it('shows the approved message and unlocks the dashboard (AC-08)', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Your account is approved')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));
    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
  });

  it('evicts the cached session on "Go to dashboard" so the app reads the freshly-provisioned role', async () => {
    // Owner provisioning at approval changes the role server-side; the pre-approval session is
    // observed from the app shell throughout onboarding, so it must be dropped on the way into the
    // app or the role-based home would route the new Owner to the Employee home (stale role).
    setAccessToken('access_valid');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['session'], { role: 'employee' });
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/onboarding/status']}>
          <Routes>
            <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
            <Route path="/" element={<div>Dashboard stub</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Your account is approved')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));

    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
    // The stale pre-approval session is gone, forcing a fresh fetch that reflects the new role.
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
  });

  it('shows the neutral under-review message without exposing restricted terms (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(statusResponse({ status: 'under_review' })),
      ),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Your application is under review')).toBeInTheDocument(),
    );
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/sanctions|watchlist|flagged/);
  });

  it('shows the support reference and contact CTA once documents are blocked (AC-04)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(
          statusResponse({ status: 'documents_blocked', supportReferenceId: 'SR-ABCD1234' }),
        ),
      ),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("We couldn't verify your documents")).toBeInTheDocument(),
    );
    expect(screen.getByText(/SR-ABCD1234/)).toBeInTheDocument();
  });
});
