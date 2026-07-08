import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompleteStepResponse, OnboardingStepId } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

async function postCompleteStep(step: OnboardingStepId): Promise<CompleteStepResponse> {
  const response = await authenticatedFetch(`/api/onboarding/steps/${step}/complete`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('complete_step_failed');
  }
  return response.json();
}

/** The server-side effect of a wizard step's "Continue" button — advances currentStep past `step`. */
export function useCompleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCompleteStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY }),
  });
}
