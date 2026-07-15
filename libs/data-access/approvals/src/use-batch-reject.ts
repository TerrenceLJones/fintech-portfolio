import { useMutation, useQueryClient } from '@tanstack/react-query';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { requestReject } from './use-reject-approval';
import { ApprovalConflictError } from './approval-conflict-error';
import type { BatchActionResult, BatchItemResult, BatchTargetItem } from './use-batch-approve';

/** A batch rejection attaches one shared reason to each selected item, notifying each submitter individually (design §7.3). */
export interface BatchRejectInput {
  items: BatchTargetItem[];
  reason: string;
}

function toSkip(item: BatchTargetItem, error: unknown): BatchItemResult {
  if (error instanceof ApprovalConflictError) {
    return { ...item, outcome: 'skipped', code: 'conflict', actedBy: error.actedBy };
  }
  return { ...item, outcome: 'skipped', code: 'failed' };
}

async function batchReject({ items, reason }: BatchRejectInput): Promise<BatchActionResult> {
  const results = await Promise.all(
    items.map(async (item): Promise<BatchItemResult> => {
      try {
        await requestReject({ id: item.id, reason });
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
 * Rejects many items at once with one shared reason, each independently (design §7.3). Like batch
 * approve there is no all-or-nothing rollback — each rejection is its own action and its own audit
 * event; an already-actioned item comes back as a skip (AC-05) rather than sinking the rest. The queue
 * is refetched once at the end.
 */
export function useBatchReject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchReject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
