import { useState } from 'react';
import type { NotificationFrequency, NotificationPreference } from '@clearline/contracts';
import { Button, NotificationToggle, Select, Text } from '@clearline/ui';
import { ToastViewport } from '../../components/ToastViewport';
import { NOTIFICATION_CATALOGUE } from '@clearline/domain-profile';
import {
  useApplyNotificationSummary,
  useNotificationPrefs,
  useUpdateNotificationPref,
} from '@clearline/data-access-profile';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { notificationsBeacon } from './notifications.beacon';
import { useToast } from '../../hooks/useToast';

const SUMMARY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

/**
 * Settings → Notifications (US-CW-034). Each row auto-saves per interaction — deliberately outside
 * the unsaved-changes footer pattern (AC-07). A bulk "Notification Summary" applies a frequency to
 * every frequency-supporting row at once, leaving non-frequency rows (security alerts) untouched
 * (AC-09); per-row edits afterward win. No permission required — everyone manages their own (AC-10).
 */
export function NotificationsPage() {
  useDemoBeacon(notificationsBeacon);
  const { data } = useNotificationPrefs();
  const updatePref = useUpdateNotificationPref();
  const applySummary = useApplyNotificationSummary();

  const [summary, setSummary] = useState<NotificationFrequency>('instant');
  const { toast, show: showToast } = useToast(2500);

  const byKey = new Map<string, NotificationPreference>(
    (data?.preferences ?? []).map((pref) => [pref.key, pref]),
  );

  if (!data) {
    return (
      <Text as="p" tone="muted">
        Loading your notification preferences…
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Text as="h2" size="heading">
        Notifications
      </Text>

      {/* Bulk summary (AC-09) */}
      <section className="border-cl-border bg-cl-surface flex flex-wrap items-center gap-3 rounded-xl border p-6">
        <div className="min-w-0 flex-1">
          <Text as="h3" size="label" weight="semibold">
            Notification Summary
          </Text>
          <Text as="p" tone="muted" size="label">
            Apply one delivery frequency to every notification that supports it. Security alerts are
            unaffected, and you can still override any row afterward.
          </Text>
        </div>
        {/* items-stretch so the Select and Apply button share one height regardless of their
            intrinsic padding — otherwise the field (~44px) and the button (~40px) don't line up. */}
        <div className="flex items-stretch gap-2">
          <div className="w-40">
            <Select
              value={summary}
              onValueChange={(value) => setSummary(value as NotificationFrequency)}
              options={SUMMARY_OPTIONS}
              aria-label="Notification Summary frequency"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            loading={applySummary.isPending}
            onClick={() =>
              applySummary.mutate(summary, { onSuccess: () => showToast('Summary applied') })
            }
          >
            Apply
          </Button>
        </div>
      </section>

      {/* Preference table (AC-07/08) */}
      <section className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border">
        <div className="border-cl-border bg-cl-inset text-cl-text-3 grid grid-cols-[1.9fr_0.6fr_0.6fr_1fr] border-b px-4 py-2.5 font-mono text-[10px] tracking-wide uppercase">
          <div>Notification</div>
          <div className="text-center">Email</div>
          <div className="text-center">In-App</div>
          <div className="text-right">Frequency</div>
        </div>
        {NOTIFICATION_CATALOGUE.map((entry) => {
          const pref = byKey.get(entry.key);
          if (!pref) return null;
          return (
            <NotificationToggle
              key={entry.key}
              label={entry.label}
              description={entry.description}
              supportsFrequency={entry.supportsFrequency}
              email={pref.email}
              inApp={pref.inApp}
              frequency={pref.frequency}
              onChange={(next) =>
                updatePref.mutate(
                  { key: entry.key, ...next },
                  { onSuccess: () => showToast('Preferences saved') },
                )
              }
            />
          );
        })}
      </section>

      <ToastViewport toast={toast} />
    </div>
  );
}
