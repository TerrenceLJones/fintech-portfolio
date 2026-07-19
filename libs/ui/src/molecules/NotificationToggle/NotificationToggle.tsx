import type { NotificationFrequency } from '@clearline/contracts';
import { Text } from '../../atoms/Text';
import { Switch } from '../../atoms/Switch';
import { Select } from '../../atoms/Select';

/** The three frequency options, in the order design §19.6 lists them. */
const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

export interface NotificationToggleProps {
  /** The notification type's human label, e.g. "Expense approved". */
  label: string;
  /** One-line description of when it fires. */
  description: string;
  email: boolean;
  inApp: boolean;
  frequency: NotificationFrequency;
  /**
   * Whether this type offers a frequency selector at all. When false (e.g. security alerts) the
   * frequency column stays empty even with a channel on — such alerts are never batched (AC-08/09).
   */
  supportsFrequency: boolean;
  /** Auto-save callback with the full next state — fired on every channel/frequency change (AC-07). */
  onChange: (next: { email: boolean; inApp: boolean; frequency: NotificationFrequency }) => void;
}

/**
 * One row of the personal notification-preferences table (design §19.6 / US-CW-034). Independent
 * Email and In-App switches, plus a frequency selector that appears ONLY when a channel is on and
 * the type supports frequency; when both channels are off, a subtle "You won't be notified" label
 * replaces it (AC-08) — frequency is meaningless with nothing to deliver. The row is stateless and
 * auto-saves through `onChange`; it is deliberately outside the unsaved-changes footer pattern (AC-07).
 */
export function NotificationToggle({
  label,
  description,
  email,
  inApp,
  frequency,
  supportsFrequency,
  onChange,
}: NotificationToggleProps) {
  const active = email || inApp;

  return (
    <div className="border-cl-border grid grid-cols-[1.9fr_0.6fr_0.6fr_1fr] items-center border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <Text as="div" size="label" weight="semibold" className="text-[13px]">
          {label}
        </Text>
        <Text as="div" tone="muted" className="text-[11.5px]">
          {description}
        </Text>
      </div>

      <div className="flex justify-center">
        <Switch
          checked={email}
          onCheckedChange={(next) => onChange({ email: next, inApp, frequency })}
          aria-label={`Email — ${label}`}
        />
      </div>

      <div className="flex justify-center">
        <Switch
          checked={inApp}
          onCheckedChange={(next) => onChange({ email, inApp: next, frequency })}
          aria-label={`In-App — ${label}`}
        />
      </div>

      <div className="flex justify-end">
        {!active ? (
          // Both channels off — frequency is meaningless (AC-08). Applies to every type.
          <Text as="span" tone="faint" className="text-[11px] italic">
            You won't be notified
          </Text>
        ) : supportsFrequency ? (
          <div className="w-36">
            <Select
              value={frequency}
              onValueChange={(next) =>
                onChange({ email, inApp, frequency: next as NotificationFrequency })
              }
              options={FREQUENCY_OPTIONS}
              aria-label={`Frequency — ${label}`}
            />
          </div>
        ) : (
          // A non-frequency type with a channel on (e.g. security alerts): no frequency control at all.
          <span aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
