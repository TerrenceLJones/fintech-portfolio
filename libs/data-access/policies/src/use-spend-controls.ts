import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type { SpendControlsResponse, UpdateSpendControlsRequest } from '@clearline/contracts';
import { policiesKeys } from './policies-query-keys';

async function getSpendControls(): Promise<SpendControlsResponse> {
  const response = await authenticatedFetch('/api/spend-controls');
  if (!response.ok) throw new Error('spend_controls_fetch_failed');
  return response.json();
}

/** Thrown when a spend-controls save is rejected (422) — carries the server's code for inline copy. */
export class SpendControlsUpdateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'SpendControlsUpdateError';
  }
}

/** The org's spend controls: receipt/memo thresholds, out-of-policy behavior, category caps (AC-06/07/08). */
export function useSpendControls() {
  return useQuery({
    queryKey: policiesKeys.spendControls,
    queryFn: getSpendControls,
    retry: false,
  });
}

async function patchSpendControls(
  request: UpdateSpendControlsRequest,
): Promise<SpendControlsResponse> {
  const response = await authenticatedFetch('/api/spend-controls', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SpendControlsUpdateError(payload.error ?? 'spend_controls_update_failed');
  }
  return response.json();
}

/** Persist spend-control changes (AC-06/07/08), priming the cache with the server's canonical copy. */
export function useUpdateSpendControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchSpendControls,
    onSuccess: (controls) => queryClient.setQueryData(policiesKeys.spendControls, controls),
  });
}
