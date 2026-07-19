import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_CATALOGUE,
  applyNotificationSummary,
  defaultNotificationPrefs,
  hasActiveChannel,
  notificationCatalogueEntry,
} from './notification-catalogue';

describe('notification catalogue', () => {
  it('marks security alerts as the only non-frequency type', () => {
    const nonFrequency = NOTIFICATION_CATALOGUE.filter((e) => !e.supportsFrequency).map(
      (e) => e.key,
    );
    expect(nonFrequency).toEqual(['security_alert']);
  });

  it('defaults every row to both channels on and instant frequency', () => {
    const prefs = defaultNotificationPrefs();
    expect(prefs).toHaveLength(NOTIFICATION_CATALOGUE.length);
    expect(prefs.every((p) => p.email && p.inApp && p.frequency === 'instant')).toBe(true);
  });

  it('resolves an entry by key and returns undefined for an unknown key', () => {
    expect(notificationCatalogueEntry('budget_at_80')?.label).toBe('Budget at 80%');
    // @ts-expect-error — an unknown key is not part of the union
    expect(notificationCatalogueEntry('nope')).toBeUndefined();
  });
});

describe('hasActiveChannel (AC-08)', () => {
  it('is true when either channel is on and false only when both are off', () => {
    expect(hasActiveChannel({ email: true, inApp: false })).toBe(true);
    expect(hasActiveChannel({ email: false, inApp: true })).toBe(true);
    expect(hasActiveChannel({ email: false, inApp: false })).toBe(false);
  });
});

describe('applyNotificationSummary (AC-09)', () => {
  it('sets the frequency on every frequency-supporting row and leaves security alerts untouched', () => {
    const applied = applyNotificationSummary(defaultNotificationPrefs(), 'weekly');
    const security = applied.find((p) => p.key === 'security_alert')!;
    const supported = applied.filter((p) => p.key !== 'security_alert');
    expect(supported.every((p) => p.frequency === 'weekly')).toBe(true);
    // Security alerts keep their prior (default) value — bulk-apply never rewrites them.
    expect(security.frequency).toBe('instant');
  });

  it('does not mutate the input array', () => {
    const prefs = defaultNotificationPrefs();
    applyNotificationSummary(prefs, 'daily');
    expect(prefs.every((p) => p.frequency === 'instant')).toBe(true);
  });
});
