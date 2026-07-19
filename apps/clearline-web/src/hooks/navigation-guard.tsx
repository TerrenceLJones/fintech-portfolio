import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router';
import { ConfirmationDialog } from '@clearline/ui';
import { NavigationGuardContext, type GuardedNavigate } from './navigation-guard-context';

/**
 * A lightweight in-app navigation guard for unsaved-changes warnings (US-CW-034 AC-02), built for the
 * app's component `<BrowserRouter>` — React Router's `useBlocker` needs a data router, which the app
 * doesn't use. A page arms the guard with `useRegisterNavigationGuard(isDirty)`; the app's central
 * navigation dispatchers (the primary sidebar in AppChrome, the SettingsNav in SettingsLayout) route
 * their clicks through `useGuardedNavigate()`, which — when the guard is armed — defers the navigation
 * behind a "Discard unsaved changes?" confirmation instead of navigating immediately. Hard navigations
 * (reload, tab close, external links) are covered separately by each form's `beforeunload` handler.
 * The context + hooks live in navigation-guard-context.ts; this file exports only the provider so React
 * Fast Refresh stays happy.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const blockRef = useRef(false);
  const navigate = useNavigate();
  const [pending, setPending] = useState<{ to: string; options?: NavigateOptions } | null>(null);

  const guardedNavigate = useCallback<GuardedNavigate>(
    (to, options) => {
      if (blockRef.current) setPending({ to, options });
      else navigate(to, options);
    },
    [navigate],
  );

  const proceed = useCallback(() => {
    setPending((current) => {
      if (current) {
        // Clear the guard before leaving so the destination — and the confirm itself — don't re-block.
        blockRef.current = false;
        navigate(current.to, current.options);
      }
      return null;
    });
  }, [navigate]);

  return (
    <NavigationGuardContext.Provider value={{ blockRef, guardedNavigate }}>
      {children}
      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Discard unsaved changes?"
        body="You have unsaved changes on this page. If you leave now, they'll be lost."
        confirmLabel="Discard & leave"
        onConfirm={proceed}
        countdown={0}
      />
    </NavigationGuardContext.Provider>
  );
}
