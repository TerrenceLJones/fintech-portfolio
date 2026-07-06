export const INACTIVITY_WARNING_MS = 14 * 60 * 1000;
export const INACTIVITY_CUTOFF_MS = 15 * 60 * 1000;

export type InactivityPhase = 'active' | 'warning' | 'expired';

/** 'active' below the 14-minute mark, 'warning' from 14 minutes up to (not including) 15, 'expired' at or past 15. */
export function getInactivityPhase(lastActivityAt: number, now: number): InactivityPhase {
  const idleFor = now - lastActivityAt;
  if (idleFor >= INACTIVITY_CUTOFF_MS) return 'expired';
  if (idleFor >= INACTIVITY_WARNING_MS) return 'warning';
  return 'active';
}

/** Seconds left until the 15-minute cutoff, floored at 0 — meaningful once the phase is 'warning'. */
export function getWarningSecondsRemaining(lastActivityAt: number, now: number): number {
  const remainingMs = INACTIVITY_CUTOFF_MS - (now - lastActivityAt);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}
