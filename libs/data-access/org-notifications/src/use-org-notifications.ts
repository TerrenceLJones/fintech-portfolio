import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  OrgNotificationSettingsResponse,
  OrgReminderFrequency,
  RecipientCandidatesResponse,
} from '@clearline/contracts';
import {
  ORG_NOTIFICATIONS_QUERY_KEY,
  RECIPIENT_CANDIDATES_QUERY_KEY,
} from './org-notifications-query-keys';

/** Thrown when the caller lacks integrations:manage — the page degrades to AccessDenied (AC-09). */
export class OrgNotificationsForbiddenError extends Error {
  constructor() {
    super('org_notifications_forbidden');
    this.name = 'OrgNotificationsForbiddenError';
  }
}

async function getSettings(): Promise<OrgNotificationSettingsResponse> {
  const response = await authenticatedFetch('/api/org-notifications');
  if (response.status === 403) throw new OrgNotificationsForbiddenError();
  if (!response.ok) throw new Error('org_notifications_fetch_failed');
  return response.json();
}

/** The org's notification routing — budget-alert recipients + reminder cadence (AC-07/08). */
export function useOrgNotifications() {
  return useQuery({
    queryKey: ORG_NOTIFICATIONS_QUERY_KEY,
    queryFn: getSettings,
    retry: false,
  });
}

/** Org members addable to the budget-alert list (AC-07). */
export function useRecipientCandidates() {
  return useQuery({
    queryKey: RECIPIENT_CANDIDATES_QUERY_KEY,
    queryFn: async (): Promise<RecipientCandidatesResponse> => {
      const response = await authenticatedFetch('/api/org-notifications/candidates');
      if (response.status === 403) throw new OrgNotificationsForbiddenError();
      if (!response.ok) throw new Error('candidates_fetch_failed');
      return response.json();
    },
    retry: false,
  });
}

function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ORG_NOTIFICATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: RECIPIENT_CANDIDATES_QUERY_KEY });
  };
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`org_notifications_${method.toLowerCase()}_failed`);
  return response.json() as Promise<T>;
}

/** Add a member to the budget-alert recipient list (AC-07). */
export function useAddRecipient() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (recipientId: string) =>
      mutate<OrgNotificationSettingsResponse>(
        '/api/org-notifications/budget-alert-recipients',
        'POST',
        { recipientId },
      ),
    onSuccess: invalidate,
  });
}

/** Remove a member from the budget-alert recipient list (AC-07). */
export function useRemoveRecipient() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (recipientId: string) =>
      mutate<OrgNotificationSettingsResponse>(
        `/api/org-notifications/budget-alert-recipients/${recipientId}`,
        'DELETE',
      ),
    onSuccess: invalidate,
  });
}

/** Set the approval-queue reminder cadence (AC-08). */
export function useSetReminderFrequency() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (frequency: OrgReminderFrequency) =>
      mutate<OrgNotificationSettingsResponse>('/api/org-notifications/approval-reminder', 'PUT', {
        frequency,
      }),
    onSuccess: invalidate,
  });
}
