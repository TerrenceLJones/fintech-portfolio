import { Icon } from '@fintech-portfolio/icons';

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
        {approvable ? (
          <button
            type="button"
            onClick={onApprove}
            className="bg-cl-pos flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.75 text-[13px] font-semibold text-white"
          >
            <Icon name="check" size={14} />
            Approve
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="bg-cl-surface-2 text-cl-text-3 flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-4 py-2.75 text-[13px] font-semibold"
          >
            <Icon name="lock" size={13} />
            Approve
          </button>
        )}
        <button
          type="button"
          onClick={onReject}
          className="border-cl-border-2 bg-cl-surface text-cl-neg flex-1 rounded-lg border px-4 py-2.75 text-[13px] font-semibold"
        >
          Reject
        </button>
        {showEscalate ? (
          <button
            type="button"
            onClick={onEscalate}
            className="border-cl-border-2 bg-cl-surface text-cl-text-2 rounded-lg border px-3.5 py-2.75 text-[13px] font-medium"
          >
            Escalate
          </button>
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
