export interface FailedAttempt {
  timestamp: number;
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** True once 5 failed login attempts have landed within the trailing 15-minute window. */
export function isLockedOut(attempts: FailedAttempt[], now: number): boolean {
  const withinWindow = attempts.filter((attempt) => now - attempt.timestamp < LOCKOUT_WINDOW_MS);
  return withinWindow.length >= LOCKOUT_THRESHOLD;
}
