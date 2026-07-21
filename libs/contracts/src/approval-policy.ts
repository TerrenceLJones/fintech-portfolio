/**
 * The approval-limit tier ladder edited in Settings → Approval Policies (US-CW-037) and consumed,
 * unchanged, by the approval-routing logic (AC-10). There is exactly one policy model: editing a tier
 * here changes where a submitted expense routes, with no second hand-maintained copy.
 */

/** Which approver a submitted expense in a tier's amount range routes to. `auto` auto-approves it. */
export type ApproverLevel = 'auto' | 'finance_manager' | 'controller';

/**
 * One tier of the approval ladder. It covers the *inclusive* integer-minor-unit range
 * `minMinorUnits … maxMinorUnits`; `maxMinorUnits: null` is the open-ended top tier (unlimited). A
 * coherent policy tiles `[0, ∞)` with no gap and no overlap — adjacent tiers meet at
 * `next.minMinorUnits === prev.maxMinorUnits + 1` (US-CW-037 AC-01/03/04).
 */
export interface ApprovalPolicyTier {
  id: string;
  minMinorUnits: number;
  maxMinorUnits: number | null;
  approver: ApproverLevel;
}

export interface ApprovalPolicyResponse {
  tiers: ApprovalPolicyTier[];
  currency: string;
}

/** A tier as submitted for save — ids are assigned server-side, so the client sends none. */
export interface ApprovalPolicyTierInput {
  minMinorUnits: number;
  maxMinorUnits: number | null;
  approver: ApproverLevel;
}

export interface UpdateApprovalPolicyRequest {
  tiers: ApprovalPolicyTierInput[];
}

export type ApprovalPolicyErrorCode = 'forbidden_role' | 'unauthenticated' | 'incoherent_policy';

export interface ApprovalPolicyErrorResponse {
  error: ApprovalPolicyErrorCode;
  /** When `incoherent_policy`, the specific gap/overlap messages the server rejected (AC-03/AC-04). */
  issues?: string[];
}
