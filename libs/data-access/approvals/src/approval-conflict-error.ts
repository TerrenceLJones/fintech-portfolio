/**
 * Thrown when an approval action hits a 409 — the item was already actioned by another approver
 * before this (stale) request arrived (US-CW-012 AC-05). Carries the approver who already actioned it
 * so the page can show "This expense was already approved by {name}" and refresh to server truth,
 * rather than silently applying a duplicate decision.
 */
export class ApprovalConflictError extends Error {
  readonly actedBy: string;

  constructor(actedBy: string) {
    super(`approval_conflict: ${actedBy}`);
    this.name = 'ApprovalConflictError';
    this.actedBy = actedBy;
  }
}
