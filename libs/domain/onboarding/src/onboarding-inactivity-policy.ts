export const ONBOARDING_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/** Onboarding steps time out after 30 minutes idle — the client resumes from the last completed step, not the beginning (US-CW-004 AC-06). */
export function hasOnboardingSessionTimedOut(lastActivityAt: number, now: number): boolean {
  return now - lastActivityAt >= ONBOARDING_INACTIVITY_TIMEOUT_MS;
}
