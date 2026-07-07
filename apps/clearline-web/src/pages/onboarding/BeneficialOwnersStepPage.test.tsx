import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { BeneficialOwnersStepPage } from './BeneficialOwnersStepPage';

const server = registerMswServer();

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/owners']}>
        <Routes>
          <Route path="/onboarding/owners" element={<BeneficialOwnersStepPage />} />
          <Route path="/onboarding/documents" element={<div>Documents step stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BeneficialOwnersStepPage', () => {
  afterEach(() => clearAccessToken());

  it('flags a 60%-ownership owner as requiring KYC and collects DOB/SSN (AC-05)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/owners', () =>
        HttpResponse.json({
          owner: {
            id: 'owner_1',
            firstName: 'Dara',
            lastName: 'Reyes',
            fullName: 'Dara Reyes',
            ownershipPercent: 60,
            requiresKyc: true,
            ssnItinLast4: '4417',
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/first name/i), 'Dara');
    await user.type(screen.getByLabelText(/last name/i), 'Reyes');
    await user.type(screen.getByLabelText(/ownership/i), '60');
    await user.type(screen.getByLabelText(/date of birth/i), '1986-04-12');
    await user.type(screen.getByLabelText(/ssn/i), '123-45-4417');
    await user.click(screen.getByRole('button', { name: /add owner/i }));

    await waitFor(() => expect(screen.getByText('Dara Reyes')).toBeInTheDocument());
    expect(screen.getByText(/id verification required/i)).toBeInTheDocument();
  });

  it('disables Continue until at least one owner has been added', () => {
    setAccessToken('access_valid');
    renderPage();
    // Button uses aria-disabled (not the native disabled attribute) to stay focusable.
    expect(screen.getByRole('button', { name: /continue/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('advances to the Documents step once an owner is added and Continue is clicked', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/owners', () =>
        HttpResponse.json({
          owner: {
            id: 'owner_1',
            firstName: 'Dara',
            lastName: 'Reyes',
            fullName: 'Dara Reyes',
            ownershipPercent: 60,
            requiresKyc: true,
          },
        }),
      ),
      http.post('*/api/onboarding/steps/:step/complete', () => HttpResponse.json({})),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/first name/i), 'Dara');
    await user.type(screen.getByLabelText(/last name/i), 'Reyes');
    await user.type(screen.getByLabelText(/ownership/i), '60');
    await user.type(screen.getByLabelText(/date of birth/i), '1986-04-12');
    await user.type(screen.getByLabelText(/ssn/i), '123-45-4417');
    await user.click(screen.getByRole('button', { name: /add owner/i }));
    await waitFor(() => expect(screen.getByText('Dara Reyes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText('Documents step stub')).toBeInTheDocument());
  });

  it('shows a visible, highlighted validation error when a required field is missing for a KYC-flagged owner', async () => {
    setAccessToken('access_valid');
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/first name/i), 'Dara');
    await user.type(screen.getByLabelText(/last name/i), 'Reyes');
    await user.type(screen.getByLabelText(/ownership/i), '60');
    await user.click(screen.getByRole('button', { name: /add owner/i }));

    const dobInput = await screen.findByLabelText(/date of birth/i);
    expect(
      screen.getByText('Date of birth is required for owners at or above 25% ownership'),
    ).toBeInTheDocument();
    expect(dobInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a generic error message when adding an owner fails on the network/server', async () => {
    setAccessToken('access_valid');
    server.use(http.post('*/api/onboarding/owners', () => HttpResponse.json({}, { status: 500 })));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/first name/i), 'Dara');
    await user.type(screen.getByLabelText(/last name/i), 'Reyes');
    await user.type(screen.getByLabelText(/ownership/i), '10');
    await user.click(screen.getByRole('button', { name: /add owner/i }));

    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument(),
    );
  });
});
