import { Icon } from '@fintech-portfolio/icons';
import { Button } from '../../atoms/Button';

export interface ApprovalActionBarProps {
  canApprove?: boolean;
  /** When set (and canApprove is not explicitly true), Approve is disabled and this reason is shown — e.g. separation-of-duties. */
  reason?: string;
  showEscalate?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onEscalate?: () => void;
}

/** Approve/Reject/Escalate — disabled with a stated reason (RBAC / separation-of-duties), never silently missing. */
export function ApprovalActionBar({
  canApprove,
  reason,
  showEscalate = true,
  onApprove,
  onReject,
  onEscalate,
}: ApprovalActionBarProps) {
  const approvable = canApprove !== false && !reason;

  return (
    <div className="font-sans">
      <div className="flex gap-2.25">
        <Button
          variant="primary"
          tone="positive"
          icon={approvable ? 'check' : 'lock'}
          disabled={!approvable}
          onClick={onApprove}
          className="flex-1"
        >
          Approve
        </Button>
        <Button variant="secondary" tone="negative" onClick={onReject} className="flex-1">
          Reject
        </Button>
        {showEscalate ? (
          <Button variant="secondary" tone="neutral" onClick={onEscalate}>
            Escalate
          </Button>
        ) : null}
      </div>
      {!approvable && reason ? (
        <div className="text-cl-warn bg-cl-warn-weak mt-3 flex items-start gap-2 rounded-lg px-2.75 py-2.25 text-xs leading-relaxed">
          <Icon name="triangle-alert" size={14} className="mt-0.5 flex-shrink-0" />
          <span>{reason}</span>
        </div>
      ) : null}
    </div>
  );
}
