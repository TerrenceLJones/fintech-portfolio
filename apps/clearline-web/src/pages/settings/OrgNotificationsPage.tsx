import { useNavigate } from 'react-router';
import { AccessDenied, Chip, EmptyState, Select, Text } from '@clearline/ui';
import {
  OrgNotificationsForbiddenError,
  useAddRecipient,
  useOrgNotifications,
  useRecipientCandidates,
  useRemoveRecipient,
  useSetReminderFrequency,
} from '@clearline/data-access-org-notifications';
import type { OrgReminderFrequency } from '@clearline/contracts';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { orgNotificationsBeacon } from './org-notifications.beacon';

const FREQUENCY_OPTIONS: { value: OrgReminderFrequency; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No approval-queue reminders are sent.' },
  {
    value: 'every_24_hours',
    label: 'Every 24 hours',
    description: 'A daily digest to approvers with a pending queue.',
  },
  {
    value: 'every_72_hours',
    label: 'Every 72 hours',
    description: 'A digest every three days while items remain pending.',
  },
];

const CARD = 'border-cl-border bg-cl-surface rounded-xl border p-5';

/**
 * Settings → Organization Notifications (US-CW-039). Route org-level alerts to named recipients: a
 * budget-threshold recipient list (AC-07) and the approval-queue reminder cadence (AC-08). Each change
 * saves immediately — no unsaved-changes footer, matching the US-CW-034 toggle semantics. Gated by
 * `integrations:manage`; the data endpoint 403s independently and the page degrades to AccessDenied (AC-09).
 */
export function OrgNotificationsPage() {
  useDemoBeacon(orgNotificationsBeacon);
  const navigate = useNavigate();
  const query = useOrgNotifications();
  const candidatesQuery = useRecipientCandidates();
  const addRecipient = useAddRecipient();
  const removeRecipient = useRemoveRecipient();
  const setFrequency = useSetReminderFrequency();
  const { toast, show: showToast } = useToast(4000);

  if (query.error instanceof OrgNotificationsForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/org-notifications"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  const settings = query.data?.settings;
  const candidates = candidatesQuery.data?.candidates ?? [];

  function onAdd(recipientId: string) {
    const candidate = candidates.find((c) => c.id === recipientId);
    addRecipient.mutate(recipientId, {
      onSuccess: () => showToast(`Added ${candidate?.name ?? 'recipient'} to budget alerts`),
    });
  }

  function onRemove(recipientId: string, name: string) {
    removeRecipient.mutate(recipientId, {
      onSuccess: () => showToast(`Removed ${name} from budget alerts`),
    });
  }

  function onFrequency(value: OrgReminderFrequency) {
    setFrequency.mutate(value, {
      onSuccess: () => showToast('Approval-queue reminder updated'),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text as="h2" size="heading">
          Organization Notifications
        </Text>
        <Text as="p" size="label" tone="muted" className="mt-1">
          Route org-level alerts to the right people — no individual opt-in required.
        </Text>
      </div>

      {query.isPending || !settings ? (
        <Text as="p" tone="muted">
          Loading…
        </Text>
      ) : (
        <>
          <section className={`${CARD} flex flex-col gap-4`}>
            <div>
              <Text as="h3" size="label" weight="semibold">
                Budget threshold alerts
              </Text>
              <Text as="p" size="label" tone="muted" className="mt-1">
                These people are emailed when any department budget crosses 80% or 100% of its
                limit.
              </Text>
            </div>

            {settings.budgetAlertRecipients.length === 0 ? (
              <EmptyState
                icon="bell"
                title="No recipients yet"
                body="Add a recipient below to start routing budget-threshold alerts."
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {settings.budgetAlertRecipients.map((recipient) => (
                  <Chip
                    key={recipient.id}
                    label={recipient.name}
                    removable
                    onRemove={() => onRemove(recipient.id, recipient.name)}
                  />
                ))}
              </div>
            )}

            <div className="max-w-xs">
              <Select
                aria-label="Add a budget-alert recipient"
                value=""
                placeholder={candidates.length === 0 ? 'All members added' : 'Add a recipient…'}
                disabled={candidates.length === 0 || addRecipient.isPending}
                onValueChange={onAdd}
                options={candidates.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                  description: candidate.email,
                }))}
              />
            </div>
          </section>

          <section className={`${CARD} flex flex-col gap-4`}>
            <div>
              <Text as="h3" size="label" weight="semibold">
                Approval-queue reminders
              </Text>
              <Text as="p" size="label" tone="muted" className="mt-1">
                How often approvers with pending items receive a digest of their queue. An empty
                queue sends nothing.
              </Text>
            </div>
            <div className="max-w-xs">
              <Select
                aria-label="Approval-queue reminder frequency"
                value={settings.approvalReminderFrequency}
                disabled={setFrequency.isPending}
                onValueChange={(value) => onFrequency(value as OrgReminderFrequency)}
                options={FREQUENCY_OPTIONS}
              />
            </div>
          </section>
        </>
      )}

      <ToastViewport toast={toast} />
    </div>
  );
}
