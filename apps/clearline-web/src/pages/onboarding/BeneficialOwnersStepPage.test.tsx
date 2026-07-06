import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
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

    await user.type(screen.getByLabelText(/owner name/i), 'Dara Reyes');
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
          owner: { id: 'owner_1', fullName: 'Dara Reyes', ownershipPercent: 60, requiresKyc: true },
        }),
      ),
      http.post('*/api/onboarding/steps/:step/complete', () => HttpResponse.json({})),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/owner name/i), 'Dara Reyes');
    await user.type(screen.getByLabelText(/ownership/i), '60');
    await user.type(screen.getByLabelText(/date of birth/i), '1986-04-12');
    await user.type(screen.getByLabelText(/ssn/i), '123-45-4417');
    await user.click(screen.getByRole('button', { name: /add owner/i }));
    await waitFor(() => expect(screen.getByText('Dara Reyes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText('Documents step stub')).toBeInTheDocument());
  });
});
