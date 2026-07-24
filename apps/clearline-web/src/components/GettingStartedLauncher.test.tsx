import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { OnboardingTaskId, Role } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { GettingStartedLauncher } from './GettingStartedLauncher';
import { withQueryClient } from '../test/with-query-client';

const server = registerMswServer();

afterEach(() => clearAccessToken());

function mock({
  role,
  isOwner = false,
  isAdmin = false,
  completed = [],
  milestoneShown = false,
}: {
  role: Role;
  isOwner?: boolean;
  isAdmin?: boolean;
  completed?: OnboardingTaskId[];
  milestoneShown?: boolean;
}) {
  setAccessToken('access_valid');
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role,
        approvalLimit: null,
        currency: 'USD',
        isAdmin,
        isOwner,
      }),
    ),
    http.get('*/api/onboarding/tasks', () => HttpResponse.json({ completed, milestoneShown })),
    http.post('*/api/onboarding/milestone', () =>
      HttpResponse.json({ completed, milestoneShown: true }),
    ),
  );
}

function renderLauncher() {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<GettingStartedLauncher />} />
          <Route path="/expenses/new" element={<div>New Expense page</div>} />
        </Routes>
      </MemoryRouter>,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ),
  );
}

describe('GettingStartedLauncher', () => {
  it('shows the rail entry with role-scoped progress for an Employee (US-CW-044 AC-01)', async () => {
    mock({ role: 'employee' });
    renderLauncher();
    await waitFor(() => expect(screen.getByText('0 of 2')).toBeInTheDocument());
  });

  it('reflects prior progress from a later session, rendering done tasks as done (AC-05)', async () => {
    mock({ role: 'employee', completed: ['submit-expense'] });
    renderLauncher();
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
  });

  it('retires the launcher once every task is complete (AC-06)', async () => {
    mock({ role: 'employee', completed: ['submit-expense', 'see-cards'], milestoneShown: true });
    renderLauncher();
    // Give the query time to resolve, then assert the entry never appears.
    await waitFor(() => expect(screen.queryByText(/of 2/)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /getting started/i })).not.toBeInTheDocument();
  });

  it('opens the panel and deep-links a task, carrying the getting-started intent (AC-02/AC-03)', async () => {
    mock({ role: 'employee' });
    renderLauncher();

    await userEvent.click(await screen.findByRole('button', { name: /getting started/i }));
    expect(screen.getByText('Submit your first expense')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getByText('New Expense page')).toBeInTheDocument());
  });

  it('toggles the panel closed when the rail entry is clicked again (click-away must not reopen it)', async () => {
    mock({ role: 'employee' });
    renderLauncher();

    const entry = await screen.findByRole('button', { name: /getting started/i });
    await userEvent.click(entry);
    expect(screen.getByText('Submit your first expense')).toBeInTheDocument();

    // Clicking the rail entry fires mousedown (the panel's click-away) then click (the toggle);
    // the boundary ref must keep the entry "inside" so it closes rather than closing-then-reopening.
    await userEvent.click(entry);
    expect(screen.queryByText('Submit your first expense')).not.toBeInTheDocument();
  });

  it('celebrates the signature milestone once when it is newly complete (US-CW-047 AC-03)', async () => {
    mock({ role: 'employee', completed: ['submit-expense'], milestoneShown: false });
    renderLauncher();
    await waitFor(() =>
      expect(screen.getByText('Nice — first expense submitted')).toBeInTheDocument(),
    );
  });

  it('does not celebrate again once the milestone has been shown (AC-03 once-only)', async () => {
    mock({ role: 'employee', completed: ['submit-expense'], milestoneShown: true });
    renderLauncher();
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    expect(screen.queryByText('Nice — first expense submitted')).not.toBeInTheDocument();
  });
});
