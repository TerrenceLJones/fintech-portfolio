import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@fintech-portfolio/data-access-auth';
import { DashboardPage } from './DashboardPage';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();

afterEach(() => clearAccessToken());

describe('DashboardPage', () => {
  it('always renders the welcome copy, even before the session check resolves', () => {
    setAccessToken('access_123');
    server.use(http.get('*/api/auth/session', () => new Promise(() => {})));

    render(withQueryClient(<DashboardPage />));

    expect(screen.getByText('Welcome back.')).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it('renders the signed-in email once the session check resolves (AC-01)', async () => {
    setAccessToken('access_123');
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ userId: 'user_1', email: 'demo@clearline.dev' }),
      ),
    );

    render(withQueryClient(<DashboardPage />));

    await waitFor(() =>
      expect(screen.getByText('Signed in as demo@clearline.dev')).toBeInTheDocument(),
    );
  });

  it('does not render the signed-in line if the session check fails', async () => {
    setAccessToken('access_123');
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ error: 'invalid_token' }, { status: 401 }),
      ),
    );

    render(withQueryClient(<DashboardPage />));

    await waitFor(() => expect(screen.getByText('Welcome back.')).toBeInTheDocument());
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});
