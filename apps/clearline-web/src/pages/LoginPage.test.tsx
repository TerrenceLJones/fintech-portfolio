import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { clearAccessToken } from '@fintech-portfolio/data-access-auth';
import { LoginPage } from './LoginPage';
import { withQueryClient } from '../test/with-query-client';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearAccessToken();
});
afterAll(() => server.close());

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
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'access_123' })),
    );
    renderLoginPage();

    await fillAndSubmit('demo@clearline.dev', 'correct-password');

    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument());
  });

  it('redirects to the `next` path after successful login when present', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'access_123' })),
    );
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
        http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'access_123' })),
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
        HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 }),
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
        HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 }),
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
          { error: 'account_locked', supportReferenceId: 'SR-TEST1234' },
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
});
