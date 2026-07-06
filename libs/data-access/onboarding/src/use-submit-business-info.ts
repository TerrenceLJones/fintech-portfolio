import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SubmitBusinessInfoRequest,
  SubmitBusinessInfoResponse,
} from '@fintech-portfolio/contracts';
import { authenticatedFetch } from '@fintech-portfolio/data-access-auth';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

async function postBusinessInfo(
  request: SubmitBusinessInfoRequest,
): Promise<SubmitBusinessInfoResponse> {
  const response = await authenticatedFetch('/api/onboarding/business', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('submit_business_info_failed');
  }
  return response.json();
}

export function useSubmitBusinessInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postBusinessInfo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY }),
  });
}
