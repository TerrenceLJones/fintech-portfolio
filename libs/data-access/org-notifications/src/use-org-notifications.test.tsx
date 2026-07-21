import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { OrgNotificationSettingsResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  OrgNotificationsForbiddenError,
  useAddRecipient,
  useOrgNotifications,
} from './use-org-notifications';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const SETTINGS: OrgNotificationSettingsResponse = {
  settings: {
    budgetAlertRecipients: [
      { id: 'user_3', name: 'Sofia Whitman', email: 'controller@clearline.dev' },
    ],
    approvalReminderFrequency: 'every_24_hours',
  },
};

describe('useOrgNotifications (AC-07/08/09)', () => {
  it('loads the settings', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/org-notifications', () => HttpResponse.json(SETTINGS)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useOrgNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.settings.approvalReminderFrequency).toBe('every_24_hours');
  });

  it('surfaces a 403 as OrgNotificationsForbiddenError (AC-09)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/org-notifications', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useOrgNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrgNotificationsForbiddenError);
  });
});

describe('useAddRecipient (AC-07)', () => {
  it('returns the updated settings on success', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/org-notifications/budget-alert-recipients', () =>
        HttpResponse.json(SETTINGS, { status: 201 }),
      ),
    );
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useAddRecipient(), { wrapper });
    result.current.mutate('user_3');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.settings.budgetAlertRecipients).toHaveLength(1);
  });
});
