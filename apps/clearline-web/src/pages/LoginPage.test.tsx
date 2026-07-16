import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { clearAccessToken, getAccessToken } from '@clearline/data-access-auth';
import {
  buildAuthErrorResponse,
  buildLoginSuccessResponse,
  registerMswServer,
} from '@clearline/mock-backend/test-factories';
import { LoginPage } from './LoginPage';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderLoginPage() {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard stub</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Work email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('LoginPage', () => {
  it('redirects to the dashboard on successful login (AC-01)', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(buildLoginSuccessResponse())));
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'correct-password');

    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
  });

  it('redirects to the `next` path after successful login when present', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json(buildLoginSuccessResponse())));
    render(
      withQueryClient(
        <MemoryRouter initialEntries={[`/login?next=${encodeURIComponent('/approvals')}`]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/approvals" element={<div>Approvals stub</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    );

    await fillAndSubmit('demo@clearline.dev', 'correct-password');

    await waitFor(() => expect(screen.getByText('Approvals stub')).toBeInTheDocument());
  });

  it.each([
    ['a protocol-relative URL', '//evil.example.com'],
    ['an absolute URL', 'https://evil.example.com'],
    ['a schemeless host with no leading slash', 'evil.example.com/phish'],
  ])(
    'ignores an unsafe `next` value (%s) and falls back to / (open-redirect protection)',
    async (_description, unsafeNext) => {
      server.use(
        http.post('*/api/auth/login', () => HttpResponse.json(buildLoginSuccessResponse())),
      );
      render(
        withQueryClient(
          <MemoryRouter initialEntries={[`/login?next=${encodeURIComponent(unsafeNext)}`]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div>Dashboard stub</div>} />
            </Routes>
          </MemoryRouter>,
        ),
      );

      await fillAndSubmit('demo@clearline.dev', 'correct-password');

      await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
    },
  );

  it('shows a generic error and clears the password field on wrong password (AC-02)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildAuthErrorResponse({ error: 'invalid_credentials' }), {
          status: 401,
        }),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'wrong-password');

    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''));
  });

  it('shows the identical generic error for an unregistered email (AC-03)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildAuthErrorResponse({ error: 'invalid_credentials' }), {
          status: 401,
        }),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('nobody@clearline.dev', 'whatever');

    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument();
  });

  it('shows the lockout message and support reference ID (AC-04)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          buildAuthErrorResponse({ error: 'account_locked', supportReferenceId: 'SR-TEST1234' }),
          { status: 423 },
        ),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'wrong-password');

    expect(
      await screen.findByText(
        'Your account is temporarily locked for your protection. Contact support to restore access.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/SR-TEST1234/)).toBeInTheDocument();
  });

  it('shows a verify-email message and no dashboard redirect for an unverified account (AC-07)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildAuthErrorResponse({ error: 'unverified_account' }), { status: 403 }),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('unverified@clearline.dev', 'correct-password');

    expect(
      await screen.findByText(
        'Verify your email to continue. Check your inbox for the link, or request a new one.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
  });

  it('resends the verification email and shows a confirmation (AC-07)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildAuthErrorResponse({ error: 'unverified_account' }), { status: 403 }),
      ),
      http.post('*/api/auth/signup', () => HttpResponse.json({})),
    );
    renderLoginPage();

    const user = await fillAndSubmit('unverified@clearline.dev', 'correct-password');
    await screen.findByText(
      'Verify your email to continue. Check your inbox for the link, or request a new one.',
    );

    await user.click(screen.getByRole('button', { name: 'Resend verification email' }));

    expect(
      await screen.findByText('Verification email sent. Check your inbox.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Resend verification email' }),
    ).not.toBeInTheDocument();
  });

  it('shows "Retrying…" while a failed attempt is still being retried (AC-05)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ error: 'server_error' }, { status: 500 }),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'correct-password');

    // The real (unmocked) useLogin hook backs this test — unlike network-retry.test.tsx, which
    // mocks the hook to test the exhausted-retries state without a slow real backoff wait. Real
    // exponential backoff gives a ~1s window after the first failed attempt before the second one
    // fires, which is enough to observe this mid-retry state deterministically without waiting for
    // all 3 retries to exhaust. The explicit 2s timeout (double Testing Library's 1s default)
    // gives headroom on a slow/contended CI runner, since that ~1s backoff window is otherwise the
    // same order of magnitude as the default assertion timeout racing it.
    expect(
      await screen.findByText('Something went wrong on our end. Retrying…', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('links "Forgot password?" to the forgot-password page', async () => {
    render(
      withQueryClient(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<div>Forgot password stub</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('Forgot password?'));
    expect(await screen.findByText('Forgot password stub')).toBeInTheDocument();
  });

  it('links "Sign up" to the sign-up page (AC-06)', async () => {
    render(
      withQueryClient(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<div>Sign up stub</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('Sign up'));
    expect(await screen.findByText('Sign up stub')).toBeInTheDocument();
  });

  it('shows a success banner when arriving with a passwordChanged navigation state', () => {
    render(
      withQueryClient(
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { passwordChanged: true } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    );

    expect(
      screen.getByText('Your password was changed. Sign in with your new password.'),
    ).toBeInTheDocument();
  });

  it('shows no success banner on a normal visit with no passwordChanged navigation state', () => {
    renderLoginPage();

    expect(
      screen.queryByText('Your password was changed. Sign in with your new password.'),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['security', 'For your security, we signed you out. Please sign in again.'],
    ['password_changed', 'Your session ended. Please sign in again.'],
    ['expired', 'Your session expired. Please sign in again.'],
    ['inactivity', 'You were signed out due to inactivity. Please sign in again.'],
  ])('shows the right banner for sessionEndReason %s (US-CW-002)', (reason, message) => {
    render(
      withQueryClient(
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { sessionEndReason: reason } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('shows the concurrent-session notice instead of navigating when login succeeds with another active session (AC-07)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildLoginSuccessResponse({ hasOtherActiveSession: true })),
      ),
    );
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'correct-password');

    await waitFor(() =>
      expect(
        screen.getByText("You're signed in on another device. Continue here?"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
  });

  it('commits the session and navigates when "Continue here" is clicked (AC-07)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildLoginSuccessResponse({ hasOtherActiveSession: true })),
      ),
    );
    renderLoginPage();

    const user = await fillAndSubmit('demo@clearline.dev', 'correct-password');
    await waitFor(() => screen.getByRole('button', { name: 'Continue here' }));
    await user.click(screen.getByRole('button', { name: 'Continue here' }));

    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
    expect(getAccessToken()).toBe('access_123');
  });

  it('revokes the session and stays on the login page when "Cancel" is clicked (AC-07)', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildLoginSuccessResponse({ hasOtherActiveSession: true })),
      ),
      http.post('*/api/auth/logout', () => HttpResponse.json({})),
    );
    renderLoginPage();

    const user = await fillAndSubmit('demo@clearline.dev', 'correct-password');
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(
        screen.queryByText("You're signed in on another device. Continue here?"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('revokes the pending session if the notice is abandoned (unmounted) without confirming or cancelling (AC-07)', async () => {
    let logoutCallCount = 0;
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildLoginSuccessResponse({ hasOtherActiveSession: true })),
      ),
      http.post('*/api/auth/logout', () => {
        logoutCallCount++;
        return HttpResponse.json({});
      }),
    );
    const { unmount } = renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'correct-password');
    await waitFor(() =>
      expect(
        screen.getByText("You're signed in on another device. Continue here?"),
      ).toBeInTheDocument(),
    );

    unmount();

    // Assert at least one revoke fired, not exactly one. `registerMswServer` resets handlers between
    // tests but doesn't cancel in-flight react-query logout mutations, so a logout dispatched on
    // unmount by an *earlier* AC-07 test can resolve against this test's handler and push the count to
    // 2 (observed under CI-level parallelism/load). The behavior under test is that abandoning the
    // notice fires a session revoke — `>= 1` captures that; the sibling test below pins the precise
    // "no revoke once resolved" (0) case.
    await waitFor(() => expect(logoutCallCount).toBeGreaterThanOrEqual(1));
  });

  it('does not revoke anything on unmount once the notice has already been resolved (AC-07)', async () => {
    let logoutCallCount = 0;
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(buildLoginSuccessResponse({ hasOtherActiveSession: true })),
      ),
      http.post('*/api/auth/logout', () => {
        logoutCallCount++;
        return HttpResponse.json({});
      }),
    );
    const { unmount } = renderLoginPage();

    const user = await fillAndSubmit('demo@clearline.dev', 'correct-password');
    await waitFor(() => screen.getByRole('button', { name: 'Continue here' }));
    await user.click(screen.getByRole('button', { name: 'Continue here' }));
    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());

    // Baseline the counter immediately before the unmount under test. `registerMswServer` only
    // resets handlers between tests — it doesn't cancel in-flight react-query mutations — so a
    // logout fired on unmount by the *previous* AC-07 test ("revokes … if abandoned") can resolve
    // against this test's handler during the async steps above and inflate the count. Zeroing here
    // scopes the assertion to what *this* unmount does, which is the behavior under test.
    logoutCallCount = 0;
    unmount();

    // Give any revoke the unmount might dispatch a real tick to reach the handler before asserting
    // none did — a bare synchronous assert would pass even if a logout were in flight.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logoutCallCount).toBe(0);
  });
});
