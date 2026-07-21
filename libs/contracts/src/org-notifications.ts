/**
 * Organization-level notification routing managed in Settings → Organization Notifications (US-CW-039).
 * Distinct from the personal notification preferences of US-CW-034: here a Controller/Admin/Owner
 * directs org-wide alerts to named recipients without those people opting in individually. Gated by
 * `integrations:manage`. Budget-threshold recipients are alerted when a department budget crosses 80%
 * or 100% (US-CW-019); the approval-queue reminder digests pending approvals (US-CW-012) on a cadence.
 * Recipient add/remove and the frequency change save immediately (no unsaved-changes footer), mirroring
 * the US-CW-034 toggle semantics.
 */

/** A person who can be routed org-level notifications — resolved from the org's members (AC-07). */
export interface OrgNotificationRecipient {
  id: string;
  name: string;
  email: string;
}

/**
 * How often approvers with a non-empty queue receive a pending-approvals digest (AC-08). `off` sends
 * none; a cadence sends a digest only while items are actually pending (an empty queue sends nothing).
 */
export type OrgReminderFrequency = 'off' | 'every_24_hours' | 'every_72_hours';

/** The org's current notification routing — the budget-alert recipients and the reminder cadence. */
export interface OrgNotificationSettings {
  budgetAlertRecipients: OrgNotificationRecipient[];
  approvalReminderFrequency: OrgReminderFrequency;
}

export interface OrgNotificationSettingsResponse {
  settings: OrgNotificationSettings;
}

/** GET /api/org-notifications/candidates — org members not already on the budget-alert list (AC-07). */
export interface RecipientCandidatesResponse {
  candidates: OrgNotificationRecipient[];
}

/** POST /api/org-notifications/budget-alert-recipients — add one member by id (AC-07). */
export interface AddRecipientRequest {
  recipientId: string;
}

/** PUT /api/org-notifications/approval-reminder — set the queue-reminder cadence (AC-08). */
export interface SetReminderFrequencyRequest {
  frequency: OrgReminderFrequency;
}

export type OrgNotificationErrorCode =
  | 'forbidden_role'
  | 'unauthenticated'
  | 'unknown_recipient'
  | 'already_recipient'
  | 'invalid_frequency';

/** Body of a 4xx from an org-notifications endpoint — the client maps `error` to inline copy. */
export interface OrgNotificationErrorResponse {
  error: OrgNotificationErrorCode;
}
