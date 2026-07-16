import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import type { Role } from '@clearline/contracts';
import { HomeRedirect } from './HomeRedirect';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderHome(role: Role) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role,
        approvalLimit: role === 'employee' ? null : 1_000_000,
        isAdmin: false,
        isOwner: false,
      }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/expenses" element={<div>My Expenses</div>} />
          <Route path="/approvals" element={<div>Approvals queue</div>} />
          <Route path="/dashboard" element={<div>Spend dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeRedirect', () => {
  it('sends a Finance Manager to the spend dashboard (US-CW-015)', async () => {
    renderHome('finance_manager');
    await waitFor(() => expect(screen.getByText('Spend dashboard')).toBeInTheDocument());
  });

  it('sends an Employee to My Expenses', async () => {
    renderHome('employee');
    await waitFor(() => expect(screen.getByText('My Expenses')).toBeInTheDocument());
  });
});
