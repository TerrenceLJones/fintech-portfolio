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
  | 'cards:manage'
  | 'approvals:view'
  | 'approvals:act'
  | 'reconciliation:view'
  | 'analytics:view'
  | 'budget:view'
  | 'audit:view'
  | 'team:view'
  | 'payments:create'
  // Organization-settings capabilities (EPIC-CW-022 / US-CW-033). The first group is granted to a
  // Controller or to any Admin/Owner; the second is Admin/Owner-only. As with every permission, the
  // /settings UI merely hides on these while each org-settings endpoint independently re-checks them.
  | 'org-profile:manage'
  | 'policies:manage'
  | 'card-program:manage'
  | 'bank-accounts:manage'
  | 'integrations:manage'
  | 'org-security:manage'
  | 'developer:manage'
  | 'billing:manage';

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
  /**
   * Set when the expense exceeded its category's per-transaction policy limit at submit — surfaced in
   * the queue so the approver gives it additional scrutiny (US-CW-011 AC-03).
   */
  policyFlagged?: boolean;
}

export interface ApprovalQueueResponse {
  items: ApprovalQueueItem[];
}

export type ApprovalErrorCode =
  | 'forbidden_role'
  | 'approval_limit_exceeded'
  | 'self_approval_blocked'
  /**
   * The item was already actioned (approved/rejected) by another approver before this stale request
   * arrived — returned as a 409 so the caller reconciles against server truth rather than applying a
   * duplicate decision (US-CW-012 AC-05).
   */
  | 'stale_action';

/** Body of a 403 (or 409 for `stale_action`) from an approval endpoint — the client maps `error` to the design's inline copy. */
export interface ApprovalErrorResponse {
  error: ApprovalErrorCode;
  /** Present only when error is 'approval_limit_exceeded' — the caller's own limit (minor units), for the message + escalation prompt. */
  approvalLimit?: number;
  /** Present only when error is 'stale_action' — the approver who already actioned it, for "already approved by {name}" (AC-05). */
  actedBy?: string;
}

/** Body of a reject action — the reason is required and travels back to the submitter (US-CW-012 AC-02). */
export interface RejectApprovalRequest {
  reason: string;
}

export interface ApprovalActionResponse {
  item: ApprovalQueueItem;
}
