import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { SignUpPage } from './SignUpPage';
import { withQueryClient } from '../test/with-query-client';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';

const server = registerMswServer();

const VALID_PASSWORD = 'Correct-Horse-1';

function renderSignUpPage() {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<div>Login stub</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Work email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  return user;
}

describe('SignUpPage', () => {
  it('renders the sign-up form initially', () => {
    renderSignUpPage();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('disables Create account until every password requirement is met (AC-04)', async () => {
    renderSignUpPage();
    const user = userEvent.setup();

    // Button uses aria-disabled (not the native disabled attribute) to stay focusable,
    // so we assert on aria-disabled rather than toBeDisabled()/toBeEnabled().
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.type(screen.getByLabelText('Password'), 'weak');
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.type(screen.getByLabelText('Password'), '2!Aa');
    // 'weak2!Aa' is 8 chars — still under 12
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.type(screen.getByLabelText('Password'), 'extra-chars');
    expect(screen.getByRole('button', { name: 'Create account' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('shows a live checklist reflecting which password requirements are met (AC-04)', async () => {
    renderSignUpPage();
    const user = userEvent.setup();

    expect(screen.getByText('At least 12 characters')).toBeInTheDocument();
    const lengthRow = screen.getByText('At least 12 characters').closest('[data-requirement-met]');
    expect(lengthRow).toHaveAttribute('data-requirement-met', 'false');

    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    expect(
      screen.getByText('At least 12 characters').closest('[data-requirement-met]'),
    ).toHaveAttribute('data-requirement-met', 'true');
  });

  it('does not submit when Create account is disabled', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/signup', () => {
        requestCount++;
        return HttpResponse.json({});
      }),
    );
    renderSignUpPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Work email'), 'new-owner@clearline.dev');
    await user.type(screen.getByLabelText('Password'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(requestCount).toBe(0);
  });

  it('shows the check-your-email confirmation with the submitted address on success (AC-01)', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.json({})));
    renderSignUpPage();

    await fillAndSubmit('new-owner@clearline.dev', VALID_PASSWORD);

    expect(await screen.findByText('Check your email to verify your account')).toBeInTheDocument();
    expect(screen.getByText(/new-owner@clearline\.dev/)).toBeInTheDocument();
  });

  it('shows the identical confirmation for an already-registered-looking email (AC-02, no enumeration)', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.json({})));
    renderSignUpPage();

    await fillAndSubmit('demo@clearline.dev', VALID_PASSWORD);

    expect(await screen.findByText('Check your email to verify your account')).toBeInTheDocument();
  });

  it('re-fires the request when "Resend" is clicked', async () => {
    let requestCount = 0;
    server.use(
      http.post('*/api/auth/signup', () => {
        requestCount++;
        return HttpResponse.json({});
      }),
    );
    renderSignUpPage();

    const user = await fillAndSubmit('new-owner@clearline.dev', VALID_PASSWORD);
    await screen.findByText('Check your email to verify your account');
    expect(requestCount).toBe(1);

    await user.click(screen.getByText('Resend'));
    expect(requestCount).toBe(2);
  });

  it('navigates to /login when "Log in" is clicked (AC-06)', async () => {
    renderSignUpPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Log in'));
    expect(await screen.findByText('Login stub')).toBeInTheDocument();
  });

  it('shows a retryable error on a network failure instead of the confirmation', async () => {
    server.use(http.post('*/api/auth/signup', () => HttpResponse.error()));
    renderSignUpPage();

    await fillAndSubmit('new-owner@clearline.dev', VALID_PASSWORD);

    expect(await screen.findByText('Something went wrong on our end.')).toBeInTheDocument();
    expect(screen.queryByText('Check your email to verify your account')).not.toBeInTheDocument();
  });
});
