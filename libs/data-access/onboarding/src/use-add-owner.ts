import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddOwnerRequest, AddOwnerResponse } from '@fintech-portfolio/contracts';
import { authenticatedFetch } from '@fintech-portfolio/data-access-auth';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

async function postOwner(request: AddOwnerRequest): Promise<AddOwnerResponse> {
  const response = await authenticatedFetch('/api/onboarding/owners', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('add_owner_failed');
  }
  return response.json();
}

export function useAddOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postOwner,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY }),
  });
}
