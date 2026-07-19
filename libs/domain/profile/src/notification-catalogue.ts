import type {
  NotificationFrequency,
  NotificationPreference,
  NotificationTypeKey,
} from '@clearline/contracts';

/**
 * A row in the personal notification-preferences table (design §19.6 / US-CW-034 AC-07…09). The
 * catalogue is the single source of truth for which notification types exist, how they read, and —
 * critically — which support a frequency selector. Security alerts deliberately do NOT: they can't
 * be batched or silenced by frequency, so the bulk "Notification Summary" leaves them untouched
 * (AC-09) and their row never shows a frequency control (AC-08).
 */
export interface NotificationCatalogueEntry {
  key: NotificationTypeKey;
  label: string;
  description: string;
  /** When false (e.g. security alerts), no frequency selector renders and bulk-apply skips the row. */
  supportsFrequency: boolean;
}

export const NOTIFICATION_CATALOGUE: NotificationCatalogueEntry[] = [
  {
    key: 'expense_approved',
    label: 'Expense approved',
    description: 'When an expense you submitted is approved',
    supportsFrequency: true,
  },
  {
    key: 'expense_rejected',
    label: 'Expense rejected',
    description: 'When an expense you submitted is rejected',
    supportsFrequency: true,
  },
  {
    key: 'budget_at_80',
    label: 'Budget at 80%',
    description: 'When a budget you own reaches 80% of its limit',
    supportsFrequency: true,
  },
  {
    key: 'card_transaction',
    label: 'Card transaction authorized',
    description: 'Every time one of your cards is charged',
    supportsFrequency: true,
  },
  {
    key: 'approval_requested',
    label: 'Approval requested',
    description: 'When a request is waiting for your approval',
    supportsFrequency: true,
  },
  {
    key: 'security_alert',
    label: 'Security alerts',
    description: 'New sign-ins and changes to your password or 2FA',
    supportsFrequency: false,
  },
];

/** Instant delivery is the default for a fresh account until the user tunes it. */
export const DEFAULT_NOTIFICATION_FREQUENCY: NotificationFrequency = 'instant';

/** The catalogue entry for a key, or undefined for an unknown key. */
export function notificationCatalogueEntry(
  key: NotificationTypeKey,
): NotificationCatalogueEntry | undefined {
  return NOTIFICATION_CATALOGUE.find((entry) => entry.key === key);
}

/** The default preference set for a new user: every channel on, instant frequency. */
export function defaultNotificationPrefs(): NotificationPreference[] {
  return NOTIFICATION_CATALOGUE.map((entry) => ({
    key: entry.key,
    email: true,
    inApp: true,
    frequency: DEFAULT_NOTIFICATION_FREQUENCY,
  }));
}

/**
 * Whether a type is currently delivering on any channel. The frequency selector is only meaningful
 * when this is true and the type supports frequency; otherwise the row shows "You won't be
 * notified" (AC-08).
 */
export function hasActiveChannel(pref: Pick<NotificationPreference, 'email' | 'inApp'>): boolean {
  return pref.email || pref.inApp;
}

/**
 * Bulk-apply a frequency to every frequency-supporting row, leaving non-frequency rows (security
 * alerts) untouched (AC-09). Per-row overrides made afterward simply re-write a single row, so this
 * is a starting point, not a lock.
 */
export function applyNotificationSummary(
  prefs: NotificationPreference[],
  frequency: NotificationFrequency,
): NotificationPreference[] {
  return prefs.map((pref) => {
    const entry = notificationCatalogueEntry(pref.key);
    return entry?.supportsFrequency ? { ...pref, frequency } : pref;
  });
}
