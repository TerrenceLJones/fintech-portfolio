import type { Money } from './money';

/**
 * The three approval-tier roles. Ordered by privilege only informally — authorization is decided
 * by the permission set each role maps to (see @clearline/domain-auth authorization-policy), never
 * by comparing roles directly. `isAdmin` (on SessionResponse) is deliberately NOT a role: it's
 * orthogonal to this ladder — an Employee can be an Admin, and Admin grants no approval authority.
 */
export type Role = 'employee' | 'finance_manager' | 'controller';

/**
 * A single authorization capability. The UI conditionally renders on these and every protected
 * endpoint independently re-checks them server-side (US-CW-006) — the client is never the boundary.
 */
export type Permission =
  | 'expenses:view'
  | 'cards:view'
  | 'approvals:view'
  | 'approvals:act'
  | 'reconciliation:view'
  | 'budget:view'
  | 'audit:view'
  | 'team:view'
  | 'payments:create';

/** L1 awaits a first approver; L2 is an escalation routed to a Controller (over a manager's limit). */
export type ApprovalStatus = 'pending_l1' | 'pending_l2';

export interface ApprovalQueueItem {
  id: string;
  /** The user who submitted the expense — compared against the acting approver to block self-approval. */
  submitterId: string;
  submitterName: string;
  category: string;
  amount: Money;
  /** ISO 8601 date the expense was submitted. */
  submittedDate: string;
  status: ApprovalStatus;
  /** Present once escalated — the manager who routed it to a Controller. */
  escalatedBy?: string;
}

export interface ApprovalQueueResponse {
  items: ApprovalQueueItem[];
}

export type ApprovalErrorCode =
  'forbidden_role' | 'approval_limit_exceeded' | 'self_approval_blocked';

/** Body of a 403 from an approval endpoint — the client maps `error` to the design's inline copy. */
export interface ApprovalErrorResponse {
  error: ApprovalErrorCode;
  /** Present only when error is 'approval_limit_exceeded' — the caller's own limit (minor units), for the message + escalation prompt. */
  approvalLimit?: number;
}

export interface ApprovalActionResponse {
  item: ApprovalQueueItem;
}
