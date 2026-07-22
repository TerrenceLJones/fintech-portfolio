import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { buildSessionResponse } from '@clearline/mock-backend/test-factories';
import { http, HttpResponse } from 'msw';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { RequireTwoFactorSetup } from './RequireTwoFactorSetup';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function mockSession(twoFactorSetupRequired: boolean) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json(buildSessionResponse({ twoFactorSetupRequired })),
    ),
  );
}

function renderGuard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequireTwoFactorSetup />}>
            <Route path="/" element={<div>App</div>} />
          </Route>
          <Route path="/two-factor-required" element={<div>2FA gate</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireTwoFactorSetup (AC-04)', () => {
  it('redirects a gated member into the 2FA setup gate', async () => {
    mockSession(true);
    renderGuard();
    await waitFor(() => expect(screen.getByText('2FA gate')).toBeInTheDocument());
  });

  it('lets an ungated member through to the app', async () => {
    mockSession(false);
    renderGuard();
    await waitFor(() => expect(screen.getByText('App')).toBeInTheDocument());
  });
});
