import type { IdleTimeoutMinutes } from '@clearline/contracts';

/** The idle session-timeout durations an org can select (US-CW-040 AC-05), shortest to longest. */
export const IDLE_TIMEOUT_OPTIONS: readonly { minutes: IdleTimeoutMinutes; label: string }[] = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: '8 hours' },
];

const BY_MINUTES = new Map(IDLE_TIMEOUT_OPTIONS.map((o) => [o.minutes, o.label]));

/** Whether `minutes` is one of the offered idle-timeout options — the server-side guard on a save. */
export function isValidIdleTimeout(minutes: number): minutes is IdleTimeoutMinutes {
  return BY_MINUTES.has(minutes as IdleTimeoutMinutes);
}

/** The human label for an idle-timeout duration (e.g. 60 → "1 hour"); falls back to "N minutes". */
export function idleTimeoutLabel(minutes: number): string {
  return BY_MINUTES.get(minutes as IdleTimeoutMinutes) ?? `${minutes} minutes`;
}
