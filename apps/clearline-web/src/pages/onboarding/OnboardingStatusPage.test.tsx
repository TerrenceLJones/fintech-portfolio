import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingStatusPage', () => {
  afterEach(() => clearAccessToken());

  it('shows the approved message and unlocks the dashboard (AC-08)', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Your account is approved')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));
    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
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
