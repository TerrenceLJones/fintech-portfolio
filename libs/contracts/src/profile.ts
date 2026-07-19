/**
 * The personal-profile surface (EPIC-CW-022 / US-CW-034): a user's own identity + contact details,
 * a verified email-change flow, and per-notification channel/frequency preferences. Every field here
 * is self-managed — the Profile group requires no permission (US-CW-034 AC-10). The concrete
 * notification catalogue (labels, descriptions, which types support frequency) is domain policy and
 * lives in @clearline/domain-profile; this file owns only the shared wire types.
 */

/** GET /api/profile — the signed-in user's editable identity, plus any email change awaiting confirmation. */
export interface ProfileResponse {
  userId: string;
  displayName: string;
  /** The active login email — unchanged until a pending change is confirmed (AC-03). */
  email: string;
  phone: string | null;
  jobTitle: string | null;
  /** Data URL of the user's avatar, or null when it falls back to initials (AC-06). */
  avatarUrl: string | null;
  /** A new email awaiting confirmation, or null. The current email keeps working for login until then (AC-03). */
  pendingEmail: string | null;
}

/** PATCH /api/profile — name/phone/job-title only; email has its own verified flow, avatar its own endpoint. */
export interface UpdateProfileRequest {
  displayName: string;
  phone: string | null;
  jobTitle: string | null;
}

/** POST /api/profile/avatar — the cropped square image as a data URL (client-side crop, AC-05). */
export interface UpdateAvatarRequest {
  avatarUrl: string;
}

/** POST /api/profile/email-change — request a verified swap to a new address (AC-03). */
export interface RequestEmailChangeRequest {
  newEmail: string;
}

export type RequestEmailChangeErrorCode =
  /** Not a syntactically valid address. */
  | 'invalid_email'
  /** New email equals the current one — rejected inline, no confirmation sent (edge case). */
  | 'same_as_current'
  /** Already in use by another account. */
  | 'email_taken';

export interface RequestEmailChangeErrorResponse {
  error: RequestEmailChangeErrorCode;
}

/** 200 body — the address the confirmation link was sent to; the swap is not yet applied. */
export interface RequestEmailChangeResponse {
  pendingEmail: string;
}

/** GET /api/profile/email-change/validate?token= — is an outstanding confirmation link still usable (AC-04). */
export interface ValidateEmailChangeTokenResponse {
  valid: boolean;
}

/** POST /api/profile/email-change/confirm — apply the pending swap by presenting the link's token (AC-03/04). */
export interface ConfirmEmailChangeRequest {
  token: string;
}

export type ConfirmEmailChangeOutcome = 'success' | 'token_invalid' | 'token_expired';

export interface ConfirmEmailChangeResponse {
  outcome: ConfirmEmailChangeOutcome;
  /** The now-active email — present only on success. */
  email?: string;
}

/** The channels a notification type can be delivered on (AC-07). */
export type NotificationChannel = 'email' | 'in_app';

/** How often a channel batches its notifications; only meaningful when a channel is on (AC-08). */
export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

/** The stable keys of the notification catalogue (labels/descriptions live in @clearline/domain-profile). */
export type NotificationTypeKey =
  | 'expense_approved'
  | 'expense_rejected'
  | 'budget_at_80'
  | 'card_transaction'
  | 'approval_requested'
  | 'security_alert';

/** One user's preference for a single notification type. */
export interface NotificationPreference {
  key: NotificationTypeKey;
  email: boolean;
  inApp: boolean;
  /** Retained even when both channels are off, so a re-enabled type restores its last frequency (AC-08). */
  frequency: NotificationFrequency;
}

/** GET /api/profile/notifications — every catalogue row's current preference. */
export interface NotificationPrefsResponse {
  preferences: NotificationPreference[];
}

/** PATCH /api/profile/notifications/:key — a single row's new state, auto-saved per interaction (AC-07/08). */
export interface UpdateNotificationPrefRequest {
  email: boolean;
  inApp: boolean;
  frequency: NotificationFrequency;
}

/** POST /api/profile/notifications/summary — bulk-apply a frequency to every frequency-supporting row (AC-09). */
export interface ApplyNotificationSummaryRequest {
  frequency: NotificationFrequency;
}
