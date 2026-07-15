import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalActionResponse, ApprovalErrorResponse } from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { ApprovalConflictError } from './approval-conflict-error';

/** A rejection carries a required reason that travels back to the submitter (US-CW-012 AC-02). */
export interface RejectApprovalInput {
  id: string;
  reason: string;
}

/**
 * Rejects a single item with its required reason, mapping a 409 to ApprovalConflictError (the item was
 * already actioned — AC-05). Exported so batch rejection can reuse the exact same per-item semantics.
 */
export async function requestReject({
  id,
  reason,
}: RejectApprovalInput): Promise<ApprovalActionResponse> {
  const response = await authenticatedFetch(`/api/approvals/${id}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (response.status === 409) {
    const body = (await response.json()) as ApprovalErrorResponse;
    throw new ApprovalConflictError(body.actedBy ?? 'another approver');
  }
  if (!response.ok) {
    throw new Error('reject_failed');
  }
  return response.json();
}

/**
 * Rejects an expense with a required reason, dropping it from the pending queue (US-CW-012 AC-02). The
 * server still re-checks approval authority (US-CW-006); a 409 surfaces as ApprovalConflictError so a
 * stale reject reconciles to server truth rather than double-actioning.
 */
export function useRejectApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestReject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
