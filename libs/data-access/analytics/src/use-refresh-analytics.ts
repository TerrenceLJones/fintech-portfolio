import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { ANALYTICS_QUERY_KEY } from './analytics-query-keys';

async function postRefresh(): Promise<void> {
  const response = await authenticatedFetch('/api/analytics/refresh', { method: 'POST' });
  if (!response.ok) {
    throw new Error('analytics_refresh_failed');
  }
}

/**
 * The dashboard's manual Refresh (US-CW-015 AC-06): advances the server's freshness stamp, then
 * invalidates the whole analytics subtree so every section refetches together and the "Last updated"
 * label resets. Invalidation runs even if the POST itself resolves late, so a re-fetch always follows.
 */
export function useRefreshAnalytics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postRefresh,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    },
  });
}
