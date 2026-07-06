import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@fintech-portfolio/mock-backend/test-factories';
import {
  authenticatedFetch,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@fintech-portfolio/data-access-auth';
import { SessionActivityBoundary } from './SessionActivityBoundary';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();
const MINUTE = 60 * 1000;

function LoginStub() {
  const location = useLocation();
  const state = location.state as { sessionEndReason?: string } | null;
  return (
    <div>
      Login stub {location.search} reason:{state?.sessionEndReason ?? 'none'}
    </div>
  );
}

function renderBoundary(initialEntry = '/approvals') {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route element={<SessionActivityBoundary />}>
            <Route path="/approvals" element={<div>Approvals content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );
}

beforeEach(() => {
  setAccessToken('access_123');
  server.use(http.post('*/api/auth/logout', () => HttpResponse.json({})));
});

afterEach(() => {
  clearAccessToken();
});

describe('SessionActivityBoundary', () => {
  it('renders the protected content normally with no warning modal', () => {
    renderBoundary();
    expect(screen.getByText('Approvals content')).toBeInTheDocument();
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
  });

  it('redirects to /login with the reason and preserved route once the api-client reports a non-recoverable session end (AC-02/AC-03/AC-06)', async () => {
    server.use(
      http.get('*/api/protected', () =>
        HttpResponse.json({ error: 'session_revoked_password_changed' }, { status: 401 }),
      ),
    );
    renderBoundary('/approvals?tab=pending');

    await act(async () => {
      await authenticatedFetch('/api/protected');
    });

    await waitFor(() =>
      expect(
        screen.getByText('Login stub ?next=%2Fapprovals%3Ftab%3Dpending reason:password_changed'),
      ).toBeInTheDocument(),
    );
  });

  it('shows the inactivity warning modal at the 14-minute mark and signs out at 15 with no action (AC-04)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBoundary();

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MINUTE);
    });

    await waitFor(() =>
      expect(screen.getByText(/Login stub.*reason:inactivity/)).toBeInTheDocument(),
    );
    expect(getAccessToken()).toBeNull();
    vi.useRealTimers();
  });

  it('dismisses the warning and resets the timer on "Stay signed in" (AC-05)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(13 * MINUTE);
    });
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('signs out immediately when "Sign out" is clicked from the warning modal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBoundary();

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByText(/Login stub/)).toBeInTheDocument());
    vi.useRealTimers();
  });
});
