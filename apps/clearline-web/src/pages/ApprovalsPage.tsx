import type { ApprovalErrorCode, ApprovalQueueItem, Money } from '@clearline/contracts';
import { canApprove } from '@clearline/domain-auth';
import { toMajorUnits } from '@clearline/money';
import { AccessDenied, Button, EmptyState, Icon, Text, formatMoney } from '@clearline/ui';
import { useAuthorization, useSession } from '@clearline/data-access-auth';
import {
  ApprovalsForbiddenError,
  useApprovalQueue,
  useApproveExpense,
  useEscalateApproval,
  useRejectApproval,
} from '@clearline/data-access-approvals';
/** Queue table columns: Employee · category | Date | Amount | Action. */
const COLS = '1.7fr 0.8fr 0.9fr 1.6fr';

/** Adapts a minor-units Money to the shared major-units formatter, so currency/locale rules stay in one place. */
function formatMoneyAmount(money: Money): string {
  return formatMoney(toMajorUnits(money), money.currency);
}

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
      return `This exceeds your approval limit of ${formatMoneyAmount({
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
  const { permissions, approvalLimit } = useAuthorization();
  const { data: session } = useSession();
  const queue = useApprovalQueue();
  const approve = useApproveExpense();
  const reject = useRejectApproval();
  const escalate = useEscalateApproval();

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
                : formatMoneyAmount({ amountMinorUnits: approvalLimit, currency: 'USD' })}
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

            return (
              <div
                key={item.id}
                data-approval-row
                className={[
                  'grid items-start gap-4 px-4 py-3.25 text-[13px]',
                  i < items.length - 1 ? 'border-cl-border border-b' : '',
                  overLimit ? 'bg-cl-warn-weak' : '',
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
                    tone={overLimit ? 'warning' : 'muted'}
                    className="mb-0 flex items-center gap-1"
                  >
                    {overLimit ? (
                      <Icon name="triangle-alert" size={11} className="shrink-0" />
                    ) : null}
                    {item.category}
                    {overLimit ? ' · over your limit' : ''}
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
                  {formatMoneyAmount(item.amount)}
                </Text>
                <div className="flex items-center justify-end gap-2">
                  {overLimit ? (
                    // Over-limit collapses to a single Escalate action (design §3.1); the limit
                    // message stays available to screen readers via the linked reason node so
                    // AC-06 holds without a reason block cluttering the compact row.
                    <>
                      <span id={`reason-${item.id}`} className="sr-only">
                        {reasonText(decision.reason, approvalLimit)}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="arrow-up"
                        aria-describedby={`reason-${item.id}`}
                        onClick={() => escalate.mutate(item.id)}
                      >
                        Escalate to Controller
                      </Button>
                    </>
                  ) : (
                    <>
                      {!decision.allowed ? (
                        <span id={`reason-${item.id}`} className="sr-only">
                          {reasonText(decision.reason, approvalLimit)}
                        </span>
                      ) : null}
                      <Button variant="danger" size="sm" onClick={() => reject.mutate(item.id)}>
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        tone="positive"
                        size="sm"
                        disabled={!decision.allowed}
                        aria-describedby={decision.allowed ? undefined : `reason-${item.id}`}
                        onClick={() => approve.mutate(item.id)}
                      >
                        Approve
                      </Button>
                    </>
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
