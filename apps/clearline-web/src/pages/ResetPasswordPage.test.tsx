import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ResetPasswordPage } from './ResetPasswordPage';
import { withQueryClient } from '../test/with-query-client';
import {
  buildResetPasswordErrorResponse,
  buildValidateResetTokenResponse,
  registerMswServer,
} from '@fintech-portfolio/mock-backend/test-factories';

const server = registerMswServer();

function LoginStub() {
  const location = useLocation();
  const state = location.state as { passwordChanged?: boolean } | null;
  return <div>Login stub{state?.passwordChanged ? ' (password changed)' : ''}</div>;
}

function renderResetPasswordPage(path = '/reset-password?token=reset_abc') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginStub />} />
          <Route path="/forgot-password" element={<div>Forgot password stub</div>} />
        </Routes>
      </MemoryRouter>,
      queryClient,
    ),
  );
}

async function fillAndSubmit(password: string, confirmPassword: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), confirmPassword);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  return user;
}

describe('ResetPasswordPage', () => {
  it('renders the new-password form for a valid token (AC-03)', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse()),
      ),
    );
    renderResetPasswordPage();

    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('shows a loading state while the token is being validated', async () => {
    server.use(
      http.get(
        '*/api/auth/reset-password/validate',
        () => new Promise(() => {}), // never resolves — asserts the in-flight state only
      ),
    );
    renderResetPasswordPage();

    expect(await screen.findByText('Checking your link…')).toBeInTheDocument();
  });

  it('falls back to the expired-link notice when the validation request itself fails over the network', async () => {
    server.use(http.get('*/api/auth/reset-password/validate', () => HttpResponse.error()));
    renderResetPasswordPage();

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('renders the expired-link notice when no token is present in the URL', async () => {
    renderResetPasswordPage('/reset-password');
    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('renders the expired-link notice for an invalid/expired token (AC-02)', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse({ valid: false })),
      ),
    );
    renderResetPasswordPage();

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
  });

  it('navigates to the forgot-password page when "Resend link" is clicked', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse({ valid: false })),
      ),
    );
    renderResetPasswordPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Resend link' }));
    expect(await screen.findByText('Forgot password stub')).toBeInTheDocument();
  });

  it('blocks submission and shows an inline error when passwords do not match, without hitting the network', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse()),
      ),
      http.post('*/api/auth/reset-password', () => {
        requestCount++;
        return HttpResponse.json({});
      }),
    );
    renderResetPasswordPage();
    await screen.findByLabelText('New password');

    await fillAndSubmit('New-Horse-Battery-2', 'Different-Battery-3');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('navigates to /login with a success flag after a successful reset (AC-03)', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse()),
      ),
      http.post('*/api/auth/reset-password', () => HttpResponse.json({})),
    );
    renderResetPasswordPage();
    await screen.findByLabelText('New password');

    await fillAndSubmit('New-Horse-Battery-2', 'New-Horse-Battery-2');

    expect(await screen.findByText('Login stub (password changed)')).toBeInTheDocument();
  });

  it('surfaces the server weak_password error inline', async () => {
    server.use(
      http.get('*/api/auth/reset-password/validate', () =>
        HttpResponse.json(buildValidateResetTokenResponse()),
      ),
      http.post('*/api/auth/reset-password', () =>
        HttpResponse.json(buildResetPasswordErrorResponse({ error: 'weak_password' }), {
          status: 422,
        }),
      ),
    );
    renderResetPasswordPage();
    await screen.findByLabelText('New password');

    await fillAndSubmit('weak', 'weak');

    expect(
      await screen.findByText(
        'Password must be at least 10 characters and include an uppercase letter, a lowercase letter, and a number.',
      ),
    ).toBeInTheDocument();
  });
});
