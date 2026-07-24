import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OnboardingTaskId, OnboardingTasksResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { GETTING_STARTED_TASKS_QUERY_KEY } from './getting-started-tasks-query-key';

/**
 * Fired when getting-started completion changes outside React Query's knowledge — e.g. the dev Demo
 * Beacon force-completing or resetting a task with a raw fetch. The read model below listens for it and
 * refetches, so the launcher updates in real time rather than on the next reload/focus. (Real user
 * actions go through React Query mutations and are handled by the app's global mutation-cache hook.)
 */
export const ONBOARDING_TASKS_CHANGED_EVENT = 'clearline:onboarding-tasks-changed';

/** Notify the launcher that completion changed via a non-React-Query path (see the event above). */
export function notifyOnboardingTasksChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ONBOARDING_TASKS_CHANGED_EVENT));
  }
}

async function getTasks(): Promise<OnboardingTasksResponse> {
  const response = await authenticatedFetch('/api/onboarding/tasks');
  if (!response.ok) throw new Error('onboarding_tasks_failed');
  return response.json();
}

/**
 * The per-user getting-started read model that drives the launcher (US-CW-044) — which tasks are
 * complete and whether the signature milestone has fired. Refetched on window focus (like the session)
 * so a completion performed in another tab is reflected, and invalidated by the mutations below and by
 * the financial-flow actions the app records against.
 */
export function useGettingStartedTasks() {
  const queryClient = useQueryClient();

  // Refetch when a non-React-Query path (the Demo Beacon) changes completion, so the launcher updates
  // live. Real user actions are covered by the app's global mutation-cache invalidation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () =>
      queryClient.invalidateQueries({ queryKey: GETTING_STARTED_TASKS_QUERY_KEY });
    window.addEventListener(ONBOARDING_TASKS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_TASKS_CHANGED_EVENT, handler);
  }, [queryClient]);

  return useQuery({
    queryKey: GETTING_STARTED_TASKS_QUERY_KEY,
    queryFn: getTasks,
    retry: false,
  });
}

async function postJson(path: string): Promise<OnboardingTasksResponse> {
  const response = await authenticatedFetch(path, { method: 'POST' });
  if (!response.ok) throw new Error('onboarding_tasks_update_failed');
  return response.json();
}

/**
 * Marks a "visit" task complete when the user reaches its destination page (US-CW-046). Only visit
 * tasks may be completed this way; the server rejects any attempt to complete an event task, so this
 * can never self-report an action the user hasn't performed (US-CW-047 AC-02).
 */
export function useCompleteGettingStartedVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: OnboardingTaskId) => postJson(`/api/onboarding/tasks/${taskId}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GETTING_STARTED_TASKS_QUERY_KEY }),
  });
}

/** Latches the once-per-user signature milestone so its celebration never fires twice (US-CW-047 AC-03). */
export function useMarkGettingStartedMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/onboarding/milestone'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GETTING_STARTED_TASKS_QUERY_KEY }),
  });
}

/** Clears the current user's getting-started progress — the dev/demo "reset onboarding" control. */
export function useResetGettingStarted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson('/api/onboarding/tasks/reset'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GETTING_STARTED_TASKS_QUERY_KEY }),
  });
}
