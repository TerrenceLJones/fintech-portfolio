import { useMutation } from '@tanstack/react-query';
import type { SubmitReviewResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';

async function postSubmitReview(): Promise<SubmitReviewResponse> {
  const response = await authenticatedFetch('/api/onboarding/review/submit', { method: 'POST' });
  if (!response.ok) {
    throw new Error('submit_review_failed');
  }
  return response.json();
}

/**
 * Unlike the other onboarding mutations, this one does NOT invalidate the shared status query in its
 * own onSuccess. Submitting the review flips the server status to a terminal value (approved /
 * under_review), and the wizard route guard would redirect the still-mounted review step the instant
 * it sees that — so the caller (ReviewStepPage) must first navigate to the terminal status route and
 * only then invalidate, otherwise the guard races the navigation. Keeping the invalidation caller-
 * ordered is what makes that sequencing possible.
 */
export function useSubmitReview() {
  return useMutation({ mutationFn: postSubmitReview });
}
