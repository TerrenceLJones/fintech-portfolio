import { useEffect, useState } from 'react';

/**
 * A transient confirmation toast: `show(message)` displays it, and it clears itself after `duration`
 * ms. The auto-dismiss lifecycle lives here rather than in the presentational `Toast` atom — the atom
 * stays pure — while form pages avoid re-implementing the same setTimeout. Render with
 * `<ToastViewport toast={toast} />`. There is no manual-dismiss control: on a short timer a close
 * button would rarely be clickable before the toast clears.
 */
export function useToast(duration = 3000) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);

  return { toast, show: setToast };
}
