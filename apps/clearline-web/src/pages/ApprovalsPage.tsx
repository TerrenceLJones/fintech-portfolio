import { useEffect, useState } from 'react';
import type { ApprovalErrorCode, ApprovalQueueItem } from '@clearline/contracts';
import { canApprove } from '@clearline/domain-auth';
import {
  AccessDenied,
  Alert,
  BulkActionResult,
  Button,
  Checkbox,
  EmptyState,
  Icon,
  Modal,
  RejectReasonDialog,
  Text,
  Toast,
  formatMoneyValue,
  type BulkActionFailure,
} from '@clearline/ui';
import { useAuthorization, useSession } from '@clearline/data-access-auth';
import {
  ApprovalConflictError,
  ApprovalsForbiddenError,
  useApprovalQueue,
  useApproveExpense,
  useBatchApprove,
  useBatchReject,
  useEscalateApproval,
  useReassignApproval,
  useRejectApproval,
  type BatchActionResult,
  type BatchItemResult,
  type BatchTargetItem,
} from '@clearline/data-access-approvals';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { approvalsBeacon } from './ApprovalsPage.beacon';

/** Queue table columns: select | Employee · category | Date | Amount | Action. */
const COLS = '32px 1.6fr 0.8fr 0.9fr 1.6fr';

/** The one-tap rejection reasons offered in the reject dialog (§6.2). */
const REJECT_PRESETS = ['Out of policy', 'Missing detail', 'Duplicate'];

/** "2026-06-28" → "Jun 28" to match the queue table's date column, without pulling in a date lib. */
function formatSubmittedDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function reasonText(reason: ApprovalErrorCode, approvalLimit: number | null): string {
  switch (reason) {
    case 'self_approval_blocked':
      return "You can't approve your own expense. It needs another approver.";
    case 'approval_limit_exceeded':
      return `This exceeds your approval limit of ${formatMoneyValue({
        amountMinorUnits: approvalLimit ?? 0,
        currency: 'USD',
      })}. Route it to a Controller for approval.`;
    default:
      return "You don't have permission to approve this.";
  }
}

/** Short per-item skip reason for the batch result summary (AC-06). */
function batchSkipReason(result: Extract<BatchItemResult, { outcome: 'skipped' }>): string {
  switch (result.code) {
    case 'self_approval_blocked':
      return 'Cannot approve own expense';
    case 'approval_limit_exceeded':
      return `Exceeds your ${formatMoneyValue({
        amountMinorUnits: result.approvalLimit ?? 0,
        currency: 'USD',
      })} limit`;
    case 'conflict':
      return `Already approved by ${result.actedBy ?? 'another approver'}`;
    case 'forbidden_role':
      return 'Not permitted to approve';
    default:
      return "Couldn't be processed";
  }
}

/**
 * The approval queue for Finance Managers and Controllers (US-CW-006 / US-CW-012). Each row
 * pre-computes the same canApprove decision the server enforces, so over-limit and self-submitted
 * expenses render with their stated reason (AC-03) rather than a doomed request. On top of the
 * per-row actions this adds: a required reason on reject (AC-02), stale-action 409 reconciliation
 * against server truth (AC-05), and batch approve/reject with a per-item success/skip summary (AC-06).
 */
export function ApprovalsPage() {
  useDemoBeacon(approvalsBeacon);
  const { permissions, approvalLimit } = useAuthorization();
  const { data: session } = useSession();
  const queue = useApprovalQueue();
  const approve = useApproveExpense();
  const reject = useRejectApproval();
  const escalate = useEscalateApproval();
  const reassign = useReassignApproval();
  const batchApprove = useBatchApprove();
  const batchReject = useBatchReject();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<ApprovalQueueItem | null>(null);
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [conflict, setConflict] = useState<{ actedBy: string } | null>(null);
  const [batchResult, setBatchResult] = useState<BatchActionResult | null>(null);
  // Remembered so a "Retry" resumes with the matching mutation and — for reject — the same shared reason.
  const [batchContext, setBatchContext] = useState<{ verb: 'approve' | 'reject'; reason?: string }>(
    {
      verb: 'approve',
    },
  );
  const [toast, setToast] = useState<string | null>(null);

  // A full-success confirmation is transient (design §7.2) — auto-dismiss it after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (queue.error instanceof ApprovalsForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/approvals" />;
  }

  const items = queue.data?.items ?? [];
  const approverId = session?.userId ?? '';

  /** A stale action (approve/reject on an already-actioned item) → reconcile to server truth (AC-05). */
  function handleActionError(error: unknown) {
    if (error instanceof ApprovalConflictError) {
      setConflict({ actedBy: error.actedBy });
      void queue.refetch();
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  const selectedTargets = items
    .filter((item) => selected.has(item.id))
    .map((item) => ({ id: item.id, submitterName: item.submitterName }));
  // Count the actionable selection, not the raw set: an id selected then individually actioned
  // (and gone from the refetched queue) must not inflate the bulk-bar count or the reject-dialog count.
  const selectedCount = selectedTargets.length;

  // A failed single approve/reject that ISN'T a stale-action conflict (those get the reconcile dialog)
  // — surfaced inline so the action never just silently does nothing.
  const actionFailed =
    (approve.isError && !(approve.error instanceof ApprovalConflictError)) ||
    (reject.isError && !(reject.error instanceof ApprovalConflictError));

  /** A full-success batch confirms with a toast; anything left unresolved surfaces the result banner (§7.2). */
  function settleBatch(result: BatchActionResult, verb: 'approved' | 'rejected') {
    const unresolved = result.results.some((r) => r.outcome !== 'succeeded');
    if (unresolved) {
      setBatchResult(result);
    } else {
      setToast(`${result.succeeded} ${verb}`);
      setBatchResult(null);
    }
    setSelected(new Set());
  }

  function runBatchApprove(targets: BatchTargetItem[] = selectedTargets) {
    setBatchContext({ verb: 'approve' });
    batchApprove.mutate(targets, { onSuccess: (result) => settleBatch(result, 'approved') });
  }

  function runBatchReject(reason: string, targets: BatchTargetItem[] = selectedTargets) {
    setBatchContext({ verb: 'reject', reason });
    batchReject.mutate(
      { items: targets, reason },
      {
        onSuccess: (result) => {
          settleBatch(result, 'rejected');
          setBatchRejectOpen(false);
        },
      },
    );
  }

  // Re-run only the unresolved subset, re-sending each item's original idempotency key so the server
  // dedupes it — the already-committed successes are never touched (US-CW-013 AC-02/AC-03).
  function retryBatch(outcome: 'skipped' | 'not_processed') {
    if (!batchResult) return;
    const targets: BatchTargetItem[] = batchResult.results
      .filter((r) => r.outcome === outcome)
      .map((r) => ({
        id: r.id,
        submitterName: r.submitterName,
        idempotencyKey: r.idempotencyKey,
      }));
    if (batchContext.verb === 'approve') runBatchApprove(targets);
    else runBatchReject(batchContext.reason ?? '', targets);
  }

  const batchSkips = batchResult
    ? batchResult.results.filter(
        (r): r is Extract<BatchItemResult, { outcome: 'skipped' }> => r.outcome === 'skipped',
      )
    : [];
  const batchNotProcessed = batchResult
    ? batchResult.results.filter((r) => r.outcome === 'not_processed')
    : [];
  const batchConfirmed = batchResult
    ? batchResult.results.filter((r) => r.outcome === 'succeeded')
    : [];
  const batchFailures: BulkActionFailure[] = batchSkips.map((r) => ({
    name: r.submitterName,
    reason: batchSkipReason(r),
  }));

  return (
    <div className="font-sans">
      <div className="mb-5 flex items-center justify-between">
        <Text as="p" size="label" tone="muted">
          {items.length} awaiting your decision
        </Text>
        <div className="border-cl-border bg-cl-surface rounded-lg border px-2.5 py-1.5">
          <Text as="span" size="label" tone="muted">
            Your limit{' '}
            <Text as="span" size="mono" weight="semibold" tone="default">
              {approvalLimit === null
                ? 'Unlimited'
                : formatMoneyValue({ amountMinorUnits: approvalLimit, currency: 'USD' })}
            </Text>
          </Text>
        </div>
      </div>

      {actionFailed ? (
        <div className="mb-4">
          <Alert tone="negative" title="Couldn't complete that action. Please try again." />
        </div>
      ) : null}

      {batchResult ? (
        <div className="mb-4">
          {batchNotProcessed.length > 0 ? (
            // A mid-batch connection drop: confirmed items stay committed, the rest are resumable (AC-03).
            <BulkActionResult
              total={batchResult.total}
              succeeded={batchResult.succeeded}
              confirmed={batchConfirmed.map((r) => r.submitterName)}
              notProcessed={batchNotProcessed.map((r) => r.submitterName)}
              onRetry={() => retryBatch('not_processed')}
            />
          ) : (
            // A partial failure: successes commit, per-item skips stay visible with a retry-failed-only action.
            <BulkActionResult
              total={batchResult.total}
              succeeded={batchResult.succeeded}
              failures={batchFailures}
              onRetry={batchFailures.length > 0 ? () => retryBatch('skipped') : undefined}
            />
          )}
          <div className="mt-2 text-right">
            <Button variant="link" size="sm" onClick={() => setBatchResult(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="bg-cl-accent mb-3 flex items-center justify-between rounded-lg px-4 py-2.5 text-white">
          <Text as="span" size="label" weight="semibold" tone="default" className="text-white">
            {selectedCount} selected
          </Text>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="check"
              loading={batchApprove.isPending}
              onClick={() => runBatchApprove()}
            >
              Approve selected
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBatchRejectOpen(true)}>
              Reject selected
            </Button>
            <Button variant="link" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {queue.isPending ? (
        <Text as="p" size="label" tone="muted">
          Loading approvals…
        </Text>
      ) : items.length === 0 ? (
        <EmptyState
          icon="double-check"
          title="You're all caught up"
          body="No expenses are waiting for your approval right now."
        />
      ) : (
        <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border">
          <div
            className="bg-cl-inset border-cl-border text-cl-text-3 font-mono grid items-center border-b px-4 py-2.25 text-[11px] font-semibold tracking-wide uppercase"
            style={{ gridTemplateColumns: COLS }}
          >
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all expenses"
            />
            <div>Employee · category</div>
            <div>Date</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Action</div>
          </div>
          {items.map((item: ApprovalQueueItem, i: number) => {
            const decision = canApprove({
              permissions,
              approvalLimit,
              amount: item.amount.amountMinorUnits,
              submitterId: item.submitterId,
              approverId,
            });
            const isSelf = item.submitterId === approverId;
            const overLimit = !decision.allowed && decision.reason === 'approval_limit_exceeded';
            const selfBlocked = !decision.allowed && decision.reason === 'self_approval_blocked';
            const blocked = overLimit || selfBlocked;
            const noteSuffix = overLimit
              ? ' · over your limit'
              : selfBlocked
                ? ` · ${reasonText('self_approval_blocked', approvalLimit)}`
                : '';

            return (
              <div
                key={item.id}
                data-approval-row
                className={[
                  'grid items-start gap-4 px-4 py-3.25 text-[13px]',
                  i < items.length - 1 ? 'border-cl-border border-b' : '',
                  blocked ? 'bg-cl-warn-weak' : '',
                ].join(' ')}
                style={{ gridTemplateColumns: COLS }}
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Select ${item.submitterName}`}
                />
                <div className="min-w-0">
                  <Text as="span" size="label" weight="medium" tone="default">
                    {item.submitterName}
                    {isSelf ? (
                      <span className="bg-cl-accent-weak text-cl-accent-text ml-2 rounded px-1.5 py-0.5 text-xs font-semibold">
                        You
                      </span>
                    ) : null}
                  </Text>
                  <Text
                    as="p"
                    size="label"
                    tone={blocked ? 'warning' : 'muted'}
                    className="mt-1 mb-0 flex items-center gap-1"
                    id={selfBlocked ? `reason-${item.id}` : undefined}
                  >
                    {blocked ? <Icon name="triangle-alert" size={11} className="shrink-0" /> : null}
                    {item.category}
                    {noteSuffix}
                    {item.status === 'pending_l2' ? ' · escalated to a Controller' : ''}
                    {item.policyFlagged ? ' · flagged for scrutiny' : ''}
                  </Text>
                </div>
                <Text as="div" size="mono" tone="muted" className="pt-0.5">
                  {formatSubmittedDate(item.submittedDate)}
                </Text>
                <Text
                  as="div"
                  size="mono"
                  weight="semibold"
                  tone="default"
                  className="pt-0.5 text-right"
                >
                  {formatMoneyValue(item.amount)}
                </Text>
                <div className="flex items-center justify-end gap-2">
                  {overLimit ? (
                    <span id={`reason-${item.id}`} className="sr-only">
                      {reasonText(decision.reason, approvalLimit)}
                    </span>
                  ) : null}
                  {decision.allowed ? (
                    <>
                      <Button variant="danger" size="sm" onClick={() => setRejectTarget(item)}>
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        tone="positive"
                        size="sm"
                        onClick={() => approve.mutate(item.id, { onError: handleActionError })}
                      >
                        Approve
                      </Button>
                    </>
                  ) : overLimit ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon="arrow-up"
                      aria-describedby={`reason-${item.id}`}
                      onClick={() => escalate.mutate(item.id)}
                    >
                      Escalate to Controller
                    </Button>
                  ) : selfBlocked ? (
                    <Button
                      variant="primary"
                      size="sm"
                      aria-describedby={`reason-${item.id}`}
                      onClick={() => reassign.mutate(item.id)}
                    >
                      Reassign approver
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      tone="positive"
                      size="sm"
                      disabled
                      aria-describedby={`reason-${item.id}`}
                      onClick={() => approve.mutate(item.id)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RejectReasonDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        presets={REJECT_PRESETS}
        submitting={reject.isPending}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          reject.mutate(
            { id: rejectTarget.id, reason },
            {
              onSuccess: () => setRejectTarget(null),
              onError: (error) => {
                setRejectTarget(null);
                handleActionError(error);
              },
            },
          );
        }}
      />

      <RejectReasonDialog
        open={batchRejectOpen}
        onOpenChange={(open) => !open && setBatchRejectOpen(false)}
        count={selectedCount}
        presets={['Missing receipts', 'Wrong period']}
        submitting={batchReject.isPending}
        onConfirm={runBatchReject}
      />

      <Modal open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <div className="mb-3 flex items-center gap-2.75">
          <div className="bg-cl-neg-weak flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon name="x-circle" size={17} className="text-cl-neg" />
          </div>
          <Modal.Title asChild>
            <Text as="h2" size="heading" tone="default">
              Already approved
            </Text>
          </Modal.Title>
        </div>
        <Modal.Description asChild>
          <Text as="p" size="label" tone="muted" className="mb-4">
            This expense was already approved by {conflict?.actedBy}. Your view has been refreshed
            to the current state.
          </Text>
        </Modal.Description>
        <Modal.Close asChild>
          <Button fullWidth icon="refresh">
            View updated queue
          </Button>
        </Modal.Close>
      </Modal>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast message={toast} />
        </div>
      ) : null}
    </div>
  );
}
