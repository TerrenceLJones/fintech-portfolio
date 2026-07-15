import { useMutation, useQueryClient } from '@tanstack/react-query';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { requestReject } from './use-reject-approval';
import { runBatch, type BatchActionResult, type BatchTargetItem } from './use-batch-approve';

/** A batch rejection attaches one shared reason to each selected item, notifying each submitter individually (design §7.3). */
export interface BatchRejectInput {
  items: BatchTargetItem[];
  reason: string;
}

function batchReject({ items, reason }: BatchRejectInput): Promise<BatchActionResult> {
  return runBatch(items, (item, idempotencyKey) =>
    requestReject({ id: item.id, reason, idempotencyKey }),
  );
}

/**
 * Rejects many items at once with one shared reason, each independently (design §7.3). Like batch
 * approve there is no all-or-nothing rollback — each rejection is its own action, its own audit event,
 * and its own per-employee notification (US-CW-013 AC-04); an already-actioned item comes back as a
 * skip (AC-05) and a mid-batch connection drop leaves the rest resumable (AC-03). The reason is applied
 * individually to every item, and the queue is refetched once at the end.
 */
export function useBatchReject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchReject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
