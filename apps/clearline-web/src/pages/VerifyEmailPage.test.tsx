import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { VerifyEmailPage } from './VerifyEmailPage';
import { withQueryClient } from '../test/with-query-client';
import { getAccessToken } from '@fintech-portfolio/data-access-auth';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderVerifyEmailPage(path = '/verify?token=verify_abc') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify" element={<VerifyEmailPage />} />
          <Route path="/" element={<div>Dashboard stub</div>} />
          <Route path="/signup" element={<div>Sign up stub</div>} />
        </Routes>
      </MemoryRouter>,
      queryClient,
    ),
  );
}

describe('VerifyEmailPage', () => {
  it('shows a loading state while the token is being verified', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () => new Promise(() => {})), // never resolves
    );
    renderVerifyEmailPage();

    expect(await screen.findByText('Verifying your email…')).toBeInTheDocument();
  });

  it('stores the access token and lands on the redirect target for a valid link (AC-03)', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () => HttpResponse.json({ accessToken: 'access_123' })),
    );
    renderVerifyEmailPage();

    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument();
    expect(getAccessToken()).toBe('access_123');
  });

  it('renders the expired-link notice when no token is present in the URL', async () => {
    renderVerifyEmailPage('/verify');
    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('renders the expired-link notice for an invalid token', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ error: 'token_invalid' }, { status: 400 }),
      ),
    );
    renderVerifyEmailPage();

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('renders the expired-link notice for a token older than 24 hours (AC-05)', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ error: 'token_expired' }, { status: 400 }),
      ),
    );
    renderVerifyEmailPage();

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('navigates to /signup when "Resend link" is clicked (AC-05)', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ error: 'token_expired' }, { status: 400 }),
      ),
    );
    renderVerifyEmailPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Resend link' }));
    expect(await screen.findByText('Sign up stub')).toBeInTheDocument();
  });
});
