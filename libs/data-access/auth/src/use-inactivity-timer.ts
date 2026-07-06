import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getInactivityPhase,
  getWarningSecondsRemaining,
  type InactivityPhase,
} from '@fintech-portfolio/domain-auth';

export interface UseInactivityTimerOptions {
  onExpire: () => void;
  /** Polling granularity in ms — overridable for tests. @default 1000 */
  tickIntervalMs?: number;
}

export interface UseInactivityTimerResult {
  phase: InactivityPhase;
  secondsRemaining: number;
  /** Called on any page activity, and by the warning modal's "Stay signed in" action (US-CW-002 AC-05). */
  resetTimer: () => void;
}

// Deliberately excludes 'mousemove': the warning modal's own buttons sit under the cursor's path
// on the way to being clicked, so treating mere pointer movement as activity would dismiss the
// modal the instant the cursor approaches it — before the click that was supposed to land ever
// gets the chance to. click/keydown/scroll/touchstart are all deliberate, discrete interactions
// that don't have this self-defeating race.
const ACTIVITY_EVENTS = ['keydown', 'click', 'scroll', 'touchstart'] as const;

/**
 * Client-side idle timer for US-CW-002 AC-04/AC-05: warns at the 14-minute mark, signs out at 15
 * with no further activity. `onExpire` fires exactly once on the active→expired transition, not
 * on every tick while it stays expired, so the caller's logout logic doesn't re-fire on each poll.
 */
export function useInactivityTimer({
  onExpire,
  tickIntervalMs = 1000,
}: UseInactivityTimerOptions): UseInactivityTimerResult {
  const lastActivityRef = useRef(Date.now());
  const phaseRef = useRef<InactivityPhase>('active');
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [phase, setPhase] = useState<InactivityPhase>('active');
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getWarningSecondsRemaining(lastActivityRef.current, Date.now()),
  );

  const resetTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    phaseRef.current = 'active';
    setPhase('active');
    setSecondsRemaining(getWarningSecondsRemaining(now, now));
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const nextPhase = getInactivityPhase(lastActivityRef.current, now);
      if (phaseRef.current !== 'expired' && nextPhase === 'expired') {
        onExpireRef.current();
      }
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      setSecondsRemaining(getWarningSecondsRemaining(lastActivityRef.current, now));
    };
    const interval = window.setInterval(tick, tickIntervalMs);
    return () => window.clearInterval(interval);
  }, [tickIntervalMs]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));
    return () => ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
  }, [resetTimer]);

  return { phase, secondsRemaining, resetTimer };
}
