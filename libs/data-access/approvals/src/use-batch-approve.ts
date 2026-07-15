import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalErrorCode } from '@clearline/contracts';
import { APPROVALS_QUERY_KEY } from './approvals-query-key';
import { ApprovalError, requestApprove } from './use-approve-expense';
import { ApprovalConflictError } from './approval-conflict-error';

/**
 * One item to act on in a batch — the id to POST plus the name to show in the result summary. Its
 * `idempotencyKey` is minted once and carried through every retry so a resumed batch re-sends the same
 * key and the server dedupes it into a single committed decision (US-CW-013 AC-02).
 */
export interface BatchTargetItem {
  id: string;
  submitterName: string;
  idempotencyKey?: string;
}

/** Why an item was skipped rather than committed — a per-item server decision, not an all-or-nothing failure. */
export type BatchSkipCode = ApprovalErrorCode | 'conflict' | 'failed';

/**
 * The outcome of a single item in a batch. `succeeded`/`skipped` are per-item server verdicts;
 * `not_processed` means the request never reached the server (a mid-batch connection drop) and is safe
 * to resume with the same idempotency key (US-CW-013 AC-03). Every result carries the item's key so a
 * retry of the failed/unprocessed subset re-sends exactly the same keys.
 */
export type BatchItemResult =
  | { id: string; submitterName: string; idempotencyKey: string; outcome: 'succeeded' }
  | {
      id: string;
      submitterName: string;
      idempotencyKey: string;
      outcome: 'skipped';
      code: BatchSkipCode;
      approvalLimit?: number;
      actedBy?: string;
    }
  | { id: string; submitterName: string; idempotencyKey: string; outcome: 'not_processed' };

export interface BatchActionResult {
  total: number;
  succeeded: number;
  results: BatchItemResult[];
}

/** Mints a per-item idempotency key, generated once and reused across retries (US-CW-013 AC-02). */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** The item's existing key, or a freshly minted one on its first attempt. */
export function keyFor(item: BatchTargetItem): string {
  return item.idempotencyKey ?? generateIdempotencyKey();
}

/**
 * A dropped connection — `fetch` rejects with a TypeError — is distinct from a server verdict: the
 * item was never confirmed, so it's `not_processed` and resumable, not a reviewed skip (US-CW-013 AC-03).
 */
export function isConnectionError(error: unknown): boolean {
  return error instanceof TypeError;
}

/** Maps a per-item server error to a skip result — never rethrows, so one bad item can't sink the whole batch (AC-06). */
export function toSkip(
  item: BatchTargetItem,
  idempotencyKey: string,
  error: unknown,
): BatchItemResult {
  if (error instanceof ApprovalError) {
    return {
      id: item.id,
      submitterName: item.submitterName,
      idempotencyKey,
      outcome: 'skipped',
      code: error.code,
      ...(error.approvalLimit !== undefined ? { approvalLimit: error.approvalLimit } : {}),
    };
  }
  if (error instanceof ApprovalConflictError) {
    return {
      id: item.id,
      submitterName: item.submitterName,
      idempotencyKey,
      outcome: 'skipped',
      code: 'conflict',
      actedBy: error.actedBy,
    };
  }
  return {
    id: item.id,
    submitterName: item.submitterName,
    idempotencyKey,
    outcome: 'skipped',
    code: 'failed',
  };
}

/**
 * Runs a batch item-by-item, applying `action` (approve or reject) to each with its idempotency key.
 * Successes commit and blocked items come back as skips with their reason — neither halts the batch.
 * A dropped connection is different: the current item and every one after it are marked `not_processed`
 * and the run stops, so a resume retries only the unconfirmed tail (US-CW-013 AC-03). Sequential
 * processing is what makes the confirmed/unprocessed split deterministic.
 */
export async function runBatch(
  items: BatchTargetItem[],
  action: (item: BatchTargetItem, idempotencyKey: string) => Promise<unknown>,
): Promise<BatchActionResult> {
  // Mint each item's key ONCE, up front, so the request and its result row always agree — including
  // the item that was in flight when a connection dropped. If that request had actually committed
  // server-side before the response was lost, the resume re-sends the SAME key and the server replays
  // the original approval instead of double-applying it (US-CW-013 AC-02/AC-03).
  const keyed = items.map((item) => ({ item, idempotencyKey: keyFor(item) }));
  const results: BatchItemResult[] = [];

  for (let i = 0; i < keyed.length; i += 1) {
    const { item, idempotencyKey } = keyed[i]!;
    try {
      await action(item, idempotencyKey);
      results.push({
        id: item.id,
        submitterName: item.submitterName,
        idempotencyKey,
        outcome: 'succeeded',
      });
    } catch (error) {
      if (isConnectionError(error)) {
        // Connection lost mid-batch: this item and all remaining are unconfirmed → not_processed,
        // each keeping its already-minted key so the resume re-sends exactly those keys.
        for (let j = i; j < keyed.length; j += 1) {
          const pending = keyed[j]!;
          results.push({
            id: pending.item.id,
            submitterName: pending.item.submitterName,
            idempotencyKey: pending.idempotencyKey,
            outcome: 'not_processed',
          });
        }
        break;
      }
      results.push(toSkip(item, idempotencyKey, error));
    }
  }

  return {
    total: items.length,
    succeeded: results.filter((r) => r.outcome === 'succeeded').length,
    results,
  };
}

/**
 * Approves many items at once, each independently (US-CW-012 AC-06 / US-CW-013). There is no
 * all-or-nothing rollback: successes commit, blocked items (self-submitted, over-limit, already-actioned)
 * come back as skips with their reason, and a mid-batch connection drop leaves the confirmed items
 * committed while the rest stay resumable. The queue is refetched once at the end.
 */
export function useBatchApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: BatchTargetItem[]) =>
      runBatch(items, (item, idempotencyKey) => requestApprove(item.id, idempotencyKey)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY }),
  });
}
