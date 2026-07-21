import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { OrgNotificationRecipient, OrgNotificationSettings } from '@clearline/contracts';
import { ThemeProvider } from '@clearline/design-tokens';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { OrgNotificationsPage } from './OrgNotificationsPage';
import { withQueryClient } from '../../test/with-query-client';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const SOFIA: OrgNotificationRecipient = {
  id: 'user_3',
  name: 'Sofia Whitman',
  email: 'controller@clearline.dev',
};
const MARCUS: OrgNotificationRecipient = {
  id: 'user_1',
  name: 'Marcus Okafor',
  email: 'demo@clearline.dev',
};

function mockBackend({ authorized = true }: { authorized?: boolean } = {}) {
  setAccessToken('access_valid');
  const state: { settings: OrgNotificationSettings; candidates: OrgNotificationRecipient[] } = {
    settings: { budgetAlertRecipients: [SOFIA], approvalReminderFrequency: 'every_24_hours' },
    candidates: [MARCUS],
  };
  server.use(
    http.get('*/api/org-notifications', () =>
      authorized
        ? HttpResponse.json({ settings: state.settings })
        : HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
    ),
    http.get('*/api/org-notifications/candidates', () =>
      HttpResponse.json({ candidates: state.candidates }),
    ),
    http.post('*/api/org-notifications/budget-alert-recipients', async ({ request }) => {
      const { recipientId } = (await request.json()) as { recipientId: string };
      const added = state.candidates.find((c) => c.id === recipientId)!;
      state.settings = {
        ...state.settings,
        budgetAlertRecipients: [...state.settings.budgetAlertRecipients, added],
      };
      state.candidates = state.candidates.filter((c) => c.id !== recipientId);
      return HttpResponse.json({ settings: state.settings }, { status: 201 });
    }),
    http.delete('*/api/org-notifications/budget-alert-recipients/:id', ({ params }) => {
      state.settings = {
        ...state.settings,
        budgetAlertRecipients: state.settings.budgetAlertRecipients.filter(
          (r) => r.id !== params.id,
        ),
      };
      return HttpResponse.json({ settings: state.settings });
    }),
    http.put('*/api/org-notifications/approval-reminder', async ({ request }) => {
      const { frequency } = (await request.json()) as {
        frequency: 'off' | 'every_24_hours' | 'every_72_hours';
      };
      state.settings = { ...state.settings, approvalReminderFrequency: frequency };
      return HttpResponse.json({ settings: state.settings });
    }),
  );
  return state;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    withQueryClient(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/org-notifications']}>
          <OrgNotificationsPage />
        </MemoryRouter>
      </ThemeProvider>,
      queryClient,
    ),
  );
}

describe('OrgNotificationsPage — recipients (AC-07)', () => {
  it('lists current budget-alert recipients', async () => {
    mockBackend();
    renderPage();
    expect(await screen.findByText('Sofia Whitman')).toBeInTheDocument();
  });

  it('removes a recipient via the × and toasts', async () => {
    mockBackend();
    renderPage();
    await screen.findByText('Sofia Whitman');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Sofia Whitman' }));
    await waitFor(() =>
      expect(screen.getByText(/Removed Sofia Whitman from budget alerts/)).toBeInTheDocument(),
    );
  });
});

describe('OrgNotificationsPage — server decides (AC-09)', () => {
  it('renders AccessDenied on an independent 403', async () => {
    mockBackend({ authorized: false });
    renderPage();
    expect(await screen.findByText(/403 Forbidden/i)).toBeInTheDocument();
  });
});
