/** The default idle cutoff — 15 minutes — used when no org-configured timeout is supplied (US-CW-002). */
export const INACTIVITY_CUTOFF_MS = 15 * 60 * 1000;

/** How long before the cutoff the warning modal appears — a fixed 1-minute lead, regardless of cutoff. */
export const INACTIVITY_WARNING_LEAD_MS = 60 * 1000;

/** The default warning threshold — 14 minutes — kept for callers that reference it directly. */
export const INACTIVITY_WARNING_MS = INACTIVITY_CUTOFF_MS - INACTIVITY_WARNING_LEAD_MS;

export type InactivityPhase = 'active' | 'warning' | 'expired';

/** The idle cutoff in ms for an org-configured timeout in minutes (US-CW-040 AC-05); falls back to 15m. */
export function cutoffMsForMinutes(minutes: number | undefined): number {
  return minutes && minutes > 0 ? minutes * 60 * 1000 : INACTIVITY_CUTOFF_MS;
}

/**
 * 'active' below the warning lead, 'warning' in the final minute before the cutoff, 'expired' at or past
 * the cutoff. `cutoffMs` defaults to the 15-minute default so existing callers are unchanged; the org
 * Security & Compliance timeout (US-CW-040) threads a different cutoff in without a hardcoded value in
 * the client.
 */
export function getInactivityPhase(
  lastActivityAt: number,
  now: number,
  cutoffMs: number = INACTIVITY_CUTOFF_MS,
): InactivityPhase {
  const idleFor = now - lastActivityAt;
  if (idleFor >= cutoffMs) return 'expired';
  if (idleFor >= cutoffMs - INACTIVITY_WARNING_LEAD_MS) return 'warning';
  return 'active';
}

/** Seconds left until the cutoff, floored at 0 — meaningful once the phase is 'warning'. */
export function getWarningSecondsRemaining(
  lastActivityAt: number,
  now: number,
  cutoffMs: number = INACTIVITY_CUTOFF_MS,
): number {
  const remainingMs = cutoffMs - (now - lastActivityAt);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}
