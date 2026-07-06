import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubmitReviewResponse } from '@fintech-portfolio/contracts';
import { authenticatedFetch } from '@fintech-portfolio/data-access-auth';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

async function postSubmitReview(): Promise<SubmitReviewResponse> {
  const response = await authenticatedFetch('/api/onboarding/review/submit', { method: 'POST' });
  if (!response.ok) {
    throw new Error('submit_review_failed');
  }
  return response.json();
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSubmitReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY }),
  });
}
