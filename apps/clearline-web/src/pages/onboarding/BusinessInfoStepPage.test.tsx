import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { BusinessInfoStepPage } from './BusinessInfoStepPage';

const server = registerMswServer();

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/business']}>
        <Routes>
          <Route path="/onboarding/business" element={<BusinessInfoStepPage />} />
          <Route path="/onboarding/owners" element={<div>Owners step stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/legal business name/i), 'Northwind Labs, Inc.');
  await user.type(screen.getByLabelText(/^ein$/i), '12-3456789');
  await user.type(screen.getByLabelText(/structure/i), 'C-Corporation');
  await user.type(screen.getByLabelText(/registered address/i), '220 Mission St');
  await user.type(screen.getByLabelText(/city/i), 'San Francisco');
  await user.type(screen.getByLabelText(/^state$/i), 'CA');
  await user.type(screen.getByLabelText(/postal code/i), '94105');
}

describe('BusinessInfoStepPage', () => {
  afterEach(() => clearAccessToken());

  it('advances past the step on a verified EIN', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () => HttpResponse.json({ outcome: 'verified' })),
      http.post('*/api/onboarding/steps/:step/complete', () => HttpResponse.json({})),
    );
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText('Owners step stub')).toBeInTheDocument());
  });

  it("shows the inline EIN error when the registry can't verify it (AC-04)", async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () => HttpResponse.json({ outcome: 'ein_not_found' })),
    );
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't verify this EIN. Please check and try again."),
      ).toBeInTheDocument(),
    );
  });

  it('shows the duplicate-business message with a sign-in CTA (AC-07)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/business', () =>
        HttpResponse.json({ outcome: 'duplicate_business' }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(
        screen.getByText('It looks like your business already has an account. Sign in instead.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});
