import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { NotificationPreference } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { defaultNotificationPrefs } from '@clearline/domain-profile';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AppChrome } from '../../AppChrome';
import { settingsRoutes } from './settings-routes';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function mockNotificationsBackend(initial: NotificationPreference[] = defaultNotificationPrefs()) {
  setAccessToken('access_valid');
  const state = { prefs: initial.map((p) => ({ ...p })) };
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId: 'user_1',
        email: 'demo@clearline.dev',
        displayName: 'Marcus Okafor',
        role: 'finance_manager',
        approvalLimit: 1_000_000,
        currency: 'USD',
        isAdmin: false,
        isOwner: false,
        avatarUrl: null,
      }),
    ),
    http.get('*/api/profile/notifications', () => HttpResponse.json({ preferences: state.prefs })),
    http.patch('*/api/profile/notifications/:key', async ({ request, params }) => {
      const patch = (await request.json()) as Omit<NotificationPreference, 'key'>;
      state.prefs = state.prefs.map((p) => (p.key === params.key ? { ...p, ...patch } : p));
      return HttpResponse.json({ preferences: state.prefs });
    }),
    http.post('*/api/profile/notifications/summary', async ({ request }) => {
      const { frequency } = (await request.json()) as {
        frequency: NotificationPreference['frequency'];
      };
      state.prefs = state.prefs.map((p) => (p.key === 'security_alert' ? p : { ...p, frequency }));
      return HttpResponse.json({ preferences: state.prefs });
    }),
  );
  return state;
}

function renderNotifications() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/notifications']}>
          <Routes>
            <Route element={<AppChrome />}>{settingsRoutes()}</Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

describe('NotificationsPage — channel auto-save (AC-07)', () => {
  it('saves a channel toggle immediately and confirms it', async () => {
    mockNotificationsBackend();
    renderNotifications();

    const emailToggle = await screen.findByRole('switch', { name: 'Email — Expense approved' });
    await userEvent.click(emailToggle);

    await waitFor(() => expect(screen.getByText('Preferences saved')).toBeInTheDocument());
  });
});

describe('NotificationsPage — frequency visibility (AC-08)', () => {
  it('shows "You won\'t be notified" for a type with both channels off', async () => {
    const prefs = defaultNotificationPrefs().map((p) =>
      p.key === 'card_transaction' ? { ...p, email: false, inApp: false } : p,
    );
    mockNotificationsBackend(prefs);
    renderNotifications();

    await screen.findByRole('heading', { name: 'Notifications' });
    expect(screen.getByText("You won't be notified")).toBeInTheDocument();
    // The security-alert row also has no frequency, but it's a non-frequency type; the disabled
    // card_transaction row proves the both-channels-off path specifically.
    expect(
      screen.queryByRole('combobox', { name: 'Frequency — Card transaction authorized' }),
    ).not.toBeInTheDocument();
  });
});

describe('NotificationsPage — bulk summary (AC-09)', () => {
  it('applies a frequency to every frequency-supporting row and leaves security alerts untouched', async () => {
    const state = mockNotificationsBackend();
    renderNotifications();

    await screen.findByRole('heading', { name: 'Notifications' });

    const summary = screen.getByRole('combobox', { name: 'Notification Summary frequency' });
    await userEvent.click(summary);
    await userEvent.click(await screen.findByRole('option', { name: 'Weekly Digest' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(screen.getByText('Summary applied')).toBeInTheDocument());
    expect(state.prefs.find((p) => p.key === 'expense_approved')?.frequency).toBe('weekly');
    expect(state.prefs.find((p) => p.key === 'security_alert')?.frequency).toBe('instant');
  });
});
