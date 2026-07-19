import { Toast, type ToastTone } from '@clearline/ui';

export interface ToastViewportProps {
  /** The current message, or null when nothing is showing. */
  toast: string | null;
  tone?: ToastTone;
}

/**
 * Floats a {@link Toast} at the top-center of the viewport, above page content, so a confirmation is
 * visible regardless of scroll position. Pairs with {@link useToast}; renders nothing when idle. No
 * manual-dismiss control — these toasts auto-dismiss on a short timer, so a close button would rarely
 * be clickable before it clears.
 */
export function ToastViewport({ toast, tone }: ToastViewportProps) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto">
        <Toast message={toast} tone={tone} />
      </div>
    </div>
  );
}
