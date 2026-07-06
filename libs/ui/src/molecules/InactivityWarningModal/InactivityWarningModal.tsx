import { Dialog } from 'radix-ui';
import { Text } from '../../atoms/Text';

export interface InactivityWarningModalProps {
  open: boolean;
  /** Seconds left until the 15-minute inactivity cutoff — drives only the visual countdown ring; the body copy's "60 seconds" is fixed, matching US-CW-002 AC-04's literal wording. */
  secondsRemaining: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

// Sized to fit inside the ring SVG's 44x44 viewBox with its 4px stroke (18 + half-stroke + center
// = 42 of 44) — changing the viewBox or strokeWidth without adjusting this will clip the ring.
const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const COUNTDOWN_SECONDS = 60;

function formatCountdown(seconds: number): string {
  // Same out-of-range guard as the ring's progress calc below: seconds is parent-owned.
  const clamped = Math.min(COUNTDOWN_SECONDS, Math.max(0, seconds));
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function CountdownRing({ secondsRemaining }: { secondsRemaining: number }) {
  // Clamp first: secondsRemaining is owned by the parent's timer, not this component, so a stale
  // tick above 60 or a negative value on the way to 0 shouldn't push the ring past a full circle.
  const progress = Math.min(COUNTDOWN_SECONDS, Math.max(0, secondsRemaining)) / COUNTDOWN_SECONDS;
  // stroke-dashoffset hides length from the dash, so it runs opposite to progress: 0 offset draws
  // the full ring (time just left), CIRCUMFERENCE hides all of it (time's up).
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="mx-auto mb-3">
      <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="var(--cl-surface-2)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={RADIUS}
        fill="none"
        stroke="var(--cl-warn)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 22 22)"
      />
      <text
        x="22"
        y="26"
        textAnchor="middle"
        fontFamily="Geist Mono, monospace"
        fontSize="11"
        fontWeight="600"
        fill="var(--cl-text)"
      >
        {formatCountdown(secondsRemaining)}
      </text>
    </svg>
  );
}

/**
 * Warns at the 14-minute inactivity mark with a 60-second countdown to sign-out (US-CW-002 AC-04).
 * Dismissing the dialog any way — Escape, clicking the overlay, "Stay signed in" — counts as the
 * "or interact with the page" half of AC-05, so every dismissal path resets the timer rather than
 * only the explicit button.
 */
export function InactivityWarningModal({
  open,
  secondsRemaining,
  onStaySignedIn,
  onSignOut,
}: InactivityWarningModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onStaySignedIn();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content className="bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] max-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 text-center shadow-2xl">
          <CountdownRing secondsRemaining={secondsRemaining} />
          <Dialog.Title asChild>
            <Text as="h2" size="heading" tone="default" className="mb-2">
              Still there?
            </Text>
          </Dialog.Title>
          <Dialog.Description asChild>
            <Text as="p" size="label" weight="regular" tone="muted" className="mb-4.5">
              You'll be signed out in 60 seconds due to inactivity.
            </Text>
          </Dialog.Description>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onSignOut}
              className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={onStaySignedIn}
              className="bg-cl-accent flex-[1.5] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Stay signed in
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
