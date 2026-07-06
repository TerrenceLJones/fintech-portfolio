import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { ReviewStepPage } from './ReviewStepPage';

const server = registerMswServer();

function statusResponse() {
  return {
    businessId: 'business_1',
    status: 'in_progress',
    currentStep: 'review',
    lastCompletedStep: 'documents',
    business: {
      legalName: 'Northwind Labs, Inc.',
      ein: '12-3456789',
      structure: 'C-Corporation',
      addressLine1: '220 Mission St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
    },
    owners: [{ id: 'owner_1', fullName: 'Dara Reyes', ownershipPercent: 60, requiresKyc: true }],
    documents: [{ ownerId: 'owner_1', documentType: 'drivers_license' }],
    documentAttemptCount: 0,
    lastActivityAt: 0,
    sessionTimedOut: false,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/review']}>
        <Routes>
          <Route path="/onboarding/review" element={<ReviewStepPage />} />
          <Route path="/onboarding/status" element={<div>Status page stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReviewStepPage', () => {
  afterEach(() => clearAccessToken());

  it('renders the business and owner summary from the current onboarding status', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Northwind Labs, Inc\./)).toBeInTheDocument());
    expect(screen.getByText(/Dara Reyes/)).toBeInTheDocument();
  });

  it('requires the certification checkbox before submitting', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Northwind Labs, Inc\./)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /submit for verification/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('submits for verification once certified and shows the approved outcome', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())),
      http.post('*/api/onboarding/review/submit', () => HttpResponse.json({ outcome: 'approved' })),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Northwind Labs, Inc\./)).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => expect(screen.getByText('Status page stub')).toBeInTheDocument());
  });
});
