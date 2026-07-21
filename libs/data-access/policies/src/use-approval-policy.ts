import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  ApprovalPolicyErrorResponse,
  ApprovalPolicyResponse,
  UpdateApprovalPolicyRequest,
} from '@clearline/contracts';
import { policiesKeys } from './policies-query-keys';

/**
 * A save rejected by the server's coherence check (gap/overlap), carrying the specific messages so the
 * page can surface them (US-CW-037 AC-03/AC-04). Distinct from a generic failure so the UI can branch.
 */
export class IncoherentPolicyError extends Error {
  constructor(readonly issues: string[]) {
    super('incoherent_policy');
    this.name = 'IncoherentPolicyError';
  }
}

async function getApprovalPolicy(): Promise<ApprovalPolicyResponse> {
  const response = await authenticatedFetch('/api/approval-policy');
  if (!response.ok) throw new Error('approval_policy_fetch_failed');
  return response.json();
}

/** The org's approval-limit tier ladder (US-CW-037 AC-01). */
export function useApprovalPolicy() {
  return useQuery({
    queryKey: policiesKeys.approvalPolicy,
    queryFn: getApprovalPolicy,
    retry: false,
  });
}

async function patchApprovalPolicy(
  request: UpdateApprovalPolicyRequest,
): Promise<ApprovalPolicyResponse> {
  const response = await authenticatedFetch('/api/approval-policy', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status === 422) {
    const body = (await response.json()) as ApprovalPolicyErrorResponse;
    throw new IncoherentPolicyError(body.issues ?? []);
  }
  if (!response.ok) throw new Error('approval_policy_update_failed');
  return response.json();
}

/** Persist a new tier ladder (AC-02/AC-05), priming the cache with the server's canonical copy. */
export function useUpdateApprovalPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchApprovalPolicy,
    onSuccess: (policy) => queryClient.setQueryData(policiesKeys.approvalPolicy, policy),
  });
}
