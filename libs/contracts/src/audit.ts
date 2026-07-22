import type { Money } from './money';
import type { Role } from './rbac';

/**
 * The classes of privileged action the immutable audit log records (US-CW-021). Every mutating
 * financial flow maps to exactly one — payments, approval decisions, card-control changes, and
 * role/permission changes — plus `audit_access` for the self-referential event emitted when the log
 * itself is opened (AC-06). A category is never conveyed by colour alone; it always carries a text label.
 * `account_security` covers a user's self-service security actions — password change, 2FA enable/disable,
 * session revocation, trusted-device removal (US-CW-035 AC-11) — never recording the secret itself.
 * `company_profile` covers org-config edits to the Company Profile — primary contact, business address,
 * fiscal-year start (US-CW-036 AC-04); the KYB-verified legal name and EIN are immutable and never a target.
 * `approval_policy` covers edits to the approval-limit tier ladder and `spend_control` covers spend-control
 * changes — receipt/memo thresholds, out-of-policy behavior, per-category monthly caps (US-CW-037 AC-10).
 * `card_program` covers edits to the card-program defaults — default limits, MCC restrictions, issuance
 * policy — and `connected_account` covers connecting, verifying, reconnecting, and removing bank accounts
 * (US-CW-038 AC-10); an account number is never recorded, only its masked last four.
 * `accounting_integration` covers accounting-provider changes — connect, GL mapping, sync, reconnect,
 * disconnect (US-CW-039 AC-10) — and `org_notification` covers org-level notification routing —
 * budget-alert recipient add/remove and approval-queue reminder-frequency changes (US-CW-039 AC-10).
 * `org_security` covers organization-wide security posture changes — SSO configuration/enable, org-wide
 * 2FA enforcement, idle-timeout changes, and IP-allowlist add/remove (US-CW-040 AC-10); the uploaded IdP
 * certificate is never recorded, only its fingerprint.
 */
export type AuditCategory =
  | 'payment'
  | 'approval'
  | 'card_control'
  | 'role_change'
  | 'audit_access'
  | 'account_security'
  | 'company_profile'
  | 'approval_policy'
  | 'spend_control'
  | 'card_program'
  | 'connected_account'
  | 'accounting_integration'
  | 'org_notification'
  | 'org_security';

/**
 * A before → after diff on an audit event — the prior value and the new value for a card-control or
 * role/permission change (AC-03/AC-04). `tone` lets the client colour the "after" value, but the
 * two text values carry the meaning on their own.
 */
export interface AuditDiff {
  from: string;
  to: string;
  tone?: 'positive' | 'warning' | 'neutral' | 'negative';
}

/** Who took the action — resolved server-side from the caller's own session, never client claims. */
export interface AuditActor {
  id: string;
  /** Display name for the log's Actor column, e.g. "Sofia Whitman". */
  name: string;
  role: Role;
}

/**
 * One immutable, append-only audit record. Captures who did what, to which target, and when, with an
 * optional before → after diff (card/role changes) or a free-form `detail` (a payment's amount →
 * recipient). Payment events additionally carry the idempotency key and outcome in `meta` (AC-01).
 * Records are only ever appended — there is no field, endpoint, or code path to alter or remove one
 * once written (AC-05).
 */
export interface AuditEvent {
  id: string;
  /** ISO-8601 timestamp the action occurred — lexicographically comparable for newest-first ordering. */
  timestamp: string;
  actor: AuditActor;
  category: AuditCategory;
  /** Human label for the Action column, e.g. "Approved expense", "Froze card", "Viewed audit log". */
  action: string;
  /** The thing acted on — an expense id, a masked card, a payment reference — for the reader's context. */
  target?: { label: string; ref?: string };
  /** Before → after values for a card-control or role/permission change (AC-03/AC-04). */
  diff?: AuditDiff;
  /** Free-form detail where a diff doesn't fit, e.g. a payment's "$12,400.00 → Acme Corp". */
  detail?: string;
  /**
   * Payment-specific evidence (AC-01): the amount, recipient, idempotency key, and outcome captured on
   * every submission regardless of result, so a failed or rejected payment is auditable too.
   */
  meta?: {
    amount?: Money;
    recipient?: string;
    idempotencyKey?: string;
    outcome?: string;
  };
}

/** GET /api/audit-log — the full append-only log, newest first (Controller/Admin only, AC-06). */
export interface AuditLogResponse {
  events: AuditEvent[];
}

/**
 * Body of the 403 the audit-log endpoint returns — the redundant server-side `audit:view` check
 * behind the route guard, so a non-Controller/Admin (or a client bypassing the guard) is denied at
 * the data layer, never shown a limited view (AC-06). There is deliberately no error shape for a
 * modify/delete attempt: no such endpoint exists (AC-05).
 */
export type AuditErrorResponse = { error: 'forbidden_role' };
