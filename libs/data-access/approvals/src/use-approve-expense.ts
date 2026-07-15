import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ApprovalActionResponse,
  ApprovalErrorCode,
  ApprovalErrorResponse,
} from '@clearline/contracts';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { ApprovalConflictError } from './approval-conflict-error';

/**
 * A server-side rejection of an approval, carrying the exact reason the UI maps to the design's
 * inline copy: over-limit (with the caller's limit, for the "$10,000" message + escalation),
 * self-approval, or an outright role block. Distinct from a network error so the caller can show the
 * specific guidance rather than a generic failure.
 */
export class ApprovalError extends Error {
  readonly code: ApprovalErrorCode;
  readonly approvalLimit?: number;

  constructor(code: ApprovalErrorCode, approvalLimit?: number) {
    super(`approval_failed: ${code}`);
    this.name = 'ApprovalError';
    this.code = code;
    this.approvalLimit = approvalLimit;
  }
}

/**
 * Approves a single item, mapping the server's decisions to typed errors: a 403 to ApprovalError
 * (role/limit/self), a 409 to ApprovalConflictError (already actioned — AC-05). Exported so batch
 * approval can reuse the exact same per-item semantics.
 */
export async function requestApprove(itemId: string): Promise<ApprovalActionResponse> {
  const response = await authenticatedFetch(`/api/approvals/${itemId}/approve`, { method: 'POST' });
  if (response.status === 403) {
    const body = (await response.json()) as ApprovalErrorResponse;
    throw new ApprovalError(body.error, body.approvalLimit);
  }
  if (response.status === 409) {
    const body = (await response.json()) as ApprovalErrorResponse;
    throw new ApprovalConflictError(body.actedBy ?? 'another approver');
  }
  if (!response.ok) {
    throw new Error('approve_failed');
  }
  return response.json();
}

/**
 * Approves an expense. The server independently enforces role, approval-limit and self-approval
 * rules (US-CW-006 AC-06/AC-07); a 403 surfaces as a typed ApprovalError so the page can block the
 * action inline and offer escalation, never a silent failure. On success the queue is refetched so
 * the just-approved item drops off.
 */
export function useApproveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestApprove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
