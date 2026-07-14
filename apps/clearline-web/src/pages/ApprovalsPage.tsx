import type { ApprovalErrorCode, ApprovalQueueItem } from '@clearline/contracts';
import { canApprove } from '@clearline/domain-auth';
import { AccessDenied, Button, EmptyState, Icon, Text, formatMoneyValue } from '@clearline/ui';
import { useAuthorization, useSession } from '@clearline/data-access-auth';
import {
  ApprovalsForbiddenError,
  useApprovalQueue,
  useApproveExpense,
  useEscalateApproval,
  useReassignApproval,
  useRejectApproval,
} from '@clearline/data-access-approvals';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { approvalsBeacon } from './ApprovalsPage.beacon';
/** Queue table columns: Employee · category | Date | Amount | Action. */
const COLS = '1.7fr 0.8fr 0.9fr 1.6fr';

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

/**
 * The approval queue for Finance Managers and Controllers (US-CW-006). Each row pre-computes the same
 * canApprove decision the server enforces, so over-limit and self-submitted expenses render disabled
 * with the stated reason (AC-06/AC-07) rather than letting a doomed request through — but the server
 * is still the authority: it independently 403s these, and the action bar surfaces that too.
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

  if (queue.error instanceof ApprovalsForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/approvals" />;
  }

  const items = queue.data?.items ?? [];
  const approverId = session?.userId ?? '';

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
            // Both blocked states share the compact §3.1 treatment: warn-highlighted row, an inline
            // triangle note, and a single collapsed action (Escalate for over-limit, Reassign for
            // self) — no Approve/Reject. The full reason stays screen-reader-only (AC-06/AC-07).
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
                    // Self-blocked shows its full reason inline, so it doubles as the Reassign
                    // button's description (over-limit keeps the sr-only reason node instead).
                    id={selfBlocked ? `reason-${item.id}` : undefined}
                  >
                    {blocked ? <Icon name="triangle-alert" size={11} className="shrink-0" /> : null}
                    {item.category}
                    {noteSuffix}
                    {item.status === 'pending_l2' ? ' · escalated to a Controller' : ''}
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
                  {/* Over-limit keeps its full limit sentence as a screen-reader node (the visible
                      note only says "· over your limit"); self-blocked shows its full reason inline
                      (see the note above), so no sr-only duplicate is needed there. */}
                  {overLimit ? (
                    <span id={`reason-${item.id}`} className="sr-only">
                      {reasonText(decision.reason, approvalLimit)}
                    </span>
                  ) : null}
                  {decision.allowed ? (
                    <>
                      <Button variant="danger" size="sm" onClick={() => reject.mutate(item.id)}>
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        tone="positive"
                        size="sm"
                        onClick={() => approve.mutate(item.id)}
                      >
                        Approve
                      </Button>
                    </>
                  ) : overLimit ? (
                    // Over your limit → the one-click escalation to a Controller (AC-06).
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
                    // Your own expense → hand it to another approver, the sanctioned path past the
                    // self-approval block (AC-08).
                    <Button
                      variant="primary"
                      size="sm"
                      aria-describedby={`reason-${item.id}`}
                      onClick={() => reassign.mutate(item.id)}
                    >
                      Reassign approver
                    </Button>
                  ) : (
                    // Any other block (e.g. forbidden_role — not reachable from this queue) keeps a
                    // disabled Approve with its stated reason rather than a doomed action.
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
    </div>
  );
}
