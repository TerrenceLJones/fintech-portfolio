import { useContext, useEffect, useLayoutEffect } from 'react';
import { PageTitleSetterContext } from './page-title-context';

/**
 * Sets the title for the current route. Inside AppChrome it overrides the shell's nav-derived heading
 * and the browser tab from a single value, so the two can't diverge; the override is cleared on unmount
 * so the next route falls back to its nav label. On pages that render outside AppChrome (login,
 * sign-up, …) there's no shell to drive, so it writes document.title directly.
 */
export function usePageTitle(title: string) {
  const setOverride = useContext(PageTitleSetterContext);

  // useLayoutEffect so the override is applied before paint: navigating to a page whose title differs
  // from its nav label won't flash the nav label for a frame first.
  useLayoutEffect(() => {
    if (!setOverride) return;
    setOverride(title);
    return () => setOverride(undefined);
  }, [setOverride, title]);

  useEffect(() => {
    // Only own the tab directly with no shell above us — AppChrome writes it from the resolved title
    // otherwise, keeping the tab and the heading in lockstep.
    if (setOverride) return;
    document.title = `${title} · Clearline`;
  }, [setOverride, title]);
}
