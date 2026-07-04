import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { withQueryClient } from '../test/with-query-client';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';

const server = registerMswServer();

function renderForgotPasswordPage() {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login stub</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

async function fillAndSubmit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Work email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  return user;
}

describe('ForgotPasswordPage', () => {
  it('renders the email form initially', () => {
    renderForgotPasswordPage();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  it('shows the check-your-email confirmation for a registered-looking email (AC-01)', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.json({})));
    renderForgotPasswordPage();

    await fillAndSubmit('demo@clearline.dev');

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('shows the identical confirmation for an unregistered-looking email (AC-01, no enumeration)', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.json({})));
    renderForgotPasswordPage();

    await fillAndSubmit('nobody@clearline.dev');

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('re-fires the request when "Resend" is clicked', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/forgot-password', () => {
        requestCount++;
        return HttpResponse.json({});
      }),
    );
    renderForgotPasswordPage();

    const user = await fillAndSubmit('demo@clearline.dev');
    await screen.findByText('Check your email');
    expect(requestCount).toBe(1);

    await user.click(screen.getByText('Resend'));
    await waitFor(() => expect(requestCount).toBe(2));
  });

  it('marks Resend busy and blocks re-activation while a resend request is in flight, without pulling it out of the tab order (a11y)', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/forgot-password', () => {
        requestCount++;
        // The first request (initial submit) resolves normally; the resend click's request hangs
        // so the in-flight state is observable.
        return requestCount === 1 ? HttpResponse.json({}) : new Promise(() => {});
      }),
    );
    renderForgotPasswordPage();

    const user = await fillAndSubmit('demo@clearline.dev');
    await screen.findByText('Check your email');

    const resendButton = screen.getByRole('button', { name: 'Resend' });
    await user.click(resendButton);

    await waitFor(() => expect(resendButton).toHaveAttribute('aria-busy', 'true'));
    // Deliberately not `disabled` — a busy link-style button stays focusable/enabled so a
    // keyboard or screen-reader user doesn't lose focus context (see Button.tsx's `loading`
    // handling). A second click while busy must not fire a second request.
    expect(resendButton).toBeEnabled();

    await user.click(resendButton);
    expect(requestCount).toBe(2);
  });

  it('navigates back to sign in from the confirmation screen', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.json({})));
    renderForgotPasswordPage();

    const user = await fillAndSubmit('demo@clearline.dev');
    await screen.findByText('Check your email');

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(await screen.findByText('Login stub')).toBeInTheDocument();
  });

  it('shows a retryable error on a network failure instead of the confirmation', async () => {
    server.use(http.post('*/api/auth/forgot-password', () => HttpResponse.error()));
    renderForgotPasswordPage();

    await fillAndSubmit('demo@clearline.dev');

    expect(await screen.findByText('Something went wrong on our end.')).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });
});
