import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalErrorCode } from '@clearline/contracts';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { ApprovalError, requestApprove } from './use-approve-expense';
import { ApprovalConflictError } from './approval-conflict-error';

/** One item to act on in a batch — the id to POST plus the name to show in the result summary. */
export interface BatchTargetItem {
  id: string;
  submitterName: string;
}

/** Why an item was skipped rather than committed — a per-item server decision, not an all-or-nothing failure. */
export type BatchSkipCode = ApprovalErrorCode | 'conflict' | 'failed';

export type BatchItemResult =
  | { id: string; submitterName: string; outcome: 'succeeded' }
  | {
      id: string;
      submitterName: string;
      outcome: 'skipped';
      code: BatchSkipCode;
      approvalLimit?: number;
      actedBy?: string;
    };

export interface BatchActionResult {
  total: number;
  succeeded: number;
  results: BatchItemResult[];
}

/** Maps a per-item error to a skip result — never rethrows, so one bad item can't sink the whole batch (AC-06). */
function toSkip(item: BatchTargetItem, error: unknown): BatchItemResult {
  if (error instanceof ApprovalError) {
    return {
      ...item,
      outcome: 'skipped',
      code: error.code,
      ...(error.approvalLimit !== undefined ? { approvalLimit: error.approvalLimit } : {}),
    };
  }
  if (error instanceof ApprovalConflictError) {
    return { ...item, outcome: 'skipped', code: 'conflict', actedBy: error.actedBy };
  }
  return { ...item, outcome: 'skipped', code: 'failed' };
}

async function batchApprove(items: BatchTargetItem[]): Promise<BatchActionResult> {
  const results = await Promise.all(
    items.map(async (item): Promise<BatchItemResult> => {
      try {
        await requestApprove(item.id);
        return { ...item, outcome: 'succeeded' };
      } catch (error) {
        return toSkip(item, error);
      }
    }),
  );
  return {
    total: items.length,
    succeeded: results.filter((r) => r.outcome === 'succeeded').length,
    results,
  };
}

/**
 * Approves many items at once, each independently (US-CW-012 AC-06). There is no all-or-nothing
 * rollback: every item runs through the same per-item approve endpoint, successes commit, and blocked
 * items (a self-submitted expense, an over-limit one, an already-actioned one) come back as skips with
 * their reason — never sinking the committed approvals. The queue is refetched once at the end.
 */
export function useBatchApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchApprove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
