import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { clearAccessToken, setAccessToken } from '@fintech-portfolio/data-access-auth';
import { RequireAuth } from './RequireAuth';

function LoginStub() {
  const location = useLocation();
  return <div>Login stub {location.search}</div>;
}

function renderProtectedRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginStub />} />
        <Route element={<RequireAuth />}>
          <Route path="/approvals" element={<div>Approvals content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  afterEach(() => clearAccessToken());

  it('redirects to /login with the attempted path preserved when there is no access token', () => {
    renderProtectedRoute('/approvals?tab=pending');

    expect(screen.queryByText('Approvals content')).not.toBeInTheDocument();
    expect(
      screen.getByText('Login stub ?next=%2Fapprovals%3Ftab%3Dpending'),
    ).toBeInTheDocument();
  });

  it('renders the protected route when an access token is present', () => {
    setAccessToken('access_123');
    renderProtectedRoute('/approvals');

    expect(screen.getByText('Approvals content')).toBeInTheDocument();
  });
});
