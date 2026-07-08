import type { ApprovalErrorCode, ApprovalQueueItem, Money } from '@clearline/contracts';
import { canApprove } from '@clearline/domain-auth';
import { toMajorUnits } from '@clearline/money';
import { AccessDenied, ApprovalActionBar, EmptyState, Text, formatMoney } from '@clearline/ui';
import { useAuthorization, useSession } from '@clearline/data-access-auth';
import {
  ApprovalsForbiddenError,
  useApprovalQueue,
  useApproveExpense,
  useEscalateApproval,
  useRejectApproval,
} from '@clearline/data-access-approvals';
/** Adapts a minor-units Money to the shared major-units formatter, so currency/locale rules stay in one place. */
function formatMoneyAmount(money: Money): string {
  return formatMoney(toMajorUnits(money), money.currency);
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
        <ul className="flex flex-col gap-3">
          {items.map((item: ApprovalQueueItem) => {
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
              <li key={item.id} className="border-cl-border bg-cl-surface rounded-xl border p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <Text as="span" size="body" weight="semibold">
                      {item.submitterName}
                      {isSelf ? (
                        <span className="bg-cl-accent-weak text-cl-accent-text ml-2 rounded px-1.5 py-0.5 text-xs font-semibold">
                          You
                        </span>
                      ) : null}
                    </Text>
                    <Text as="p" size="label" tone="muted" className="mb-0">
                      {item.category}
                      {overLimit ? ' · over your limit' : ''}
                      {item.status === 'pending_l2' ? ' · escalated to a Controller' : ''}
                    </Text>
                  </div>
                  <Text as="span" size="mono" weight="semibold">
                    {formatMoneyAmount(item.amount)}
                  </Text>
                </div>
                <ApprovalActionBar
                  canApprove={decision.allowed}
                  reason={decision.allowed ? undefined : reasonText(decision.reason, approvalLimit)}
                  showEscalate={overLimit}
                  onApprove={() => approve.mutate(item.id)}
                  onReject={() => reject.mutate(item.id)}
                  onEscalate={() => escalate.mutate(item.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
