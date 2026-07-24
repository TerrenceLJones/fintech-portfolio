// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import {
  useCompleteGettingStartedVisit,
  useGettingStartedTasks,
  useResetGettingStarted,
} from './use-getting-started-tasks';
import { createQueryWrapper } from './test/create-query-wrapper';
import { GETTING_STARTED_TASKS_QUERY_KEY } from './getting-started-tasks-query-key';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false }, mutations: { retry: false } });

describe('useGettingStartedTasks', () => {
  afterEach(() => clearAccessToken());

  it('reads the per-user getting-started read model', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/tasks', () =>
        HttpResponse.json({ completed: ['submit-expense'], milestoneShown: true }),
      ),
    );

    const { result } = renderHook(() => useGettingStartedTasks(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ completed: ['submit-expense'], milestoneShown: true });
  });
});

describe('useCompleteGettingStartedVisit', () => {
  afterEach(() => clearAccessToken());

  it('posts to the task-specific complete endpoint and invalidates the read model', async () => {
    setAccessToken('access_valid');
    let requestedPath = '';
    server.use(
      http.post('*/api/onboarding/tasks/:id/complete', ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return HttpResponse.json({ completed: ['see-cards'], milestoneShown: false });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    queryClient.setQueryData(GETTING_STARTED_TASKS_QUERY_KEY, {
      completed: [],
      milestoneShown: false,
    });

    const { result } = renderHook(() => useCompleteGettingStartedVisit(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate('see-cards');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedPath).toBe('/api/onboarding/tasks/see-cards/complete');
    expect(queryClient.getQueryState(GETTING_STARTED_TASKS_QUERY_KEY)?.isInvalidated).toBe(true);
  });
});

describe('useResetGettingStarted', () => {
  afterEach(() => clearAccessToken());

  it('posts to the reset endpoint', async () => {
    setAccessToken('access_valid');
    let requestedPath = '';
    server.use(
      http.post('*/api/onboarding/tasks/reset', ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return HttpResponse.json({ completed: [], milestoneShown: false });
      }),
    );

    const { result } = renderHook(() => useResetGettingStarted(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedPath).toBe('/api/onboarding/tasks/reset');
  });
});
