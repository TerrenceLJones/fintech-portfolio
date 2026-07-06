import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@fintech-portfolio/data-access-auth';
import { RequireAuth } from './RequireAuth';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();

function LoginStub() {
  const location = useLocation();
  return <div>Login stub {location.search}</div>;
}

function renderProtectedRoute(initialEntry: string) {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route element={<RequireAuth />}>
            <Route path="/approvals" element={<div>Approvals content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ),
  );
}

describe('RequireAuth', () => {
  afterEach(() => clearAccessToken());

  it('renders the protected route immediately when an access token is already present', () => {
    setAccessToken('access_123');
    renderProtectedRoute('/approvals');

    expect(screen.getByText('Approvals content')).toBeInTheDocument();
  });

  it('resumes the session via a silent refresh and renders the protected route, without redirecting (AC-01)', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'access_resumed' })),
    );

    renderProtectedRoute('/approvals');

    await waitFor(() => expect(screen.getByText('Approvals content')).toBeInTheDocument());
    expect(screen.queryByText(/Login stub/)).not.toBeInTheDocument();
  });

  it('redirects to /login with the attempted path preserved once the silent refresh fails', async () => {
    server.use(
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ error: 'invalid_token' }, { status: 401 }),
      ),
    );

    renderProtectedRoute('/approvals?tab=pending');

    await waitFor(() =>
      expect(screen.getByText('Login stub ?next=%2Fapprovals%3Ftab%3Dpending')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Approvals content')).not.toBeInTheDocument();
  });

  it('offers a manual retry instead of redirecting when the silent refresh fails on a network error', async () => {
    server.use(http.post('*/api/auth/refresh', () => HttpResponse.error()));

    renderProtectedRoute('/approvals');

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't reach the server to verify your session."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Approvals content')).not.toBeInTheDocument();
    expect(screen.queryByText(/Login stub/)).not.toBeInTheDocument();
  });

  it('renders the protected route after a successful retry following a network error', async () => {
    let attempt = 0;
    server.use(
      http.post('*/api/auth/refresh', () => {
        attempt += 1;
        if (attempt === 1) return HttpResponse.error();
        return HttpResponse.json({ accessToken: 'access_resumed' });
      }),
    );
    const user = userEvent.setup();

    renderProtectedRoute('/approvals');

    await waitFor(() => screen.getByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Approvals content')).toBeInTheDocument());
  });
});
