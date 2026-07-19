import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  NotificationFrequency,
  NotificationPrefsResponse,
  NotificationTypeKey,
  UpdateNotificationPrefRequest,
} from '@clearline/contracts';
import { profileKeys } from './profile-query-keys';

async function getNotificationPrefs(): Promise<NotificationPrefsResponse> {
  const response = await authenticatedFetch('/api/profile/notifications');
  if (!response.ok) throw new Error('notification_prefs_fetch_failed');
  return response.json();
}

/** The signed-in user's notification preferences (US-CW-034 AC-07). */
export function useNotificationPrefs() {
  return useQuery({ queryKey: profileKeys.notifications, queryFn: getNotificationPrefs });
}

export interface UpdateNotificationPrefVariables extends UpdateNotificationPrefRequest {
  key: NotificationTypeKey;
}

/** Auto-save one notification row's channels/frequency (AC-07/08). Primes the cache with the server's copy. */
export function useUpdateNotificationPref() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key,
      email,
      inApp,
      frequency,
    }: UpdateNotificationPrefVariables): Promise<NotificationPrefsResponse> => {
      const body: UpdateNotificationPrefRequest = { email, inApp, frequency };
      const response = await authenticatedFetch(
        `/api/profile/notifications/${encodeURIComponent(key)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error('notification_pref_update_failed');
      return response.json();
    },
    onSuccess: (data) => queryClient.setQueryData(profileKeys.notifications, data),
  });
}

/** Bulk-apply a frequency to every frequency-supporting row (AC-09). */
export function useApplyNotificationSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (frequency: NotificationFrequency): Promise<NotificationPrefsResponse> => {
      const response = await authenticatedFetch('/api/profile/notifications/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frequency }),
      });
      if (!response.ok) throw new Error('notification_summary_apply_failed');
      return response.json();
    },
    onSuccess: (data) => queryClient.setQueryData(profileKeys.notifications, data),
  });
}
