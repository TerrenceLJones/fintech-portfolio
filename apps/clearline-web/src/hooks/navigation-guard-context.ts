import { createContext, useCallback, useContext, useEffect } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router';

/**
 * The shared context + hooks for the in-app unsaved-changes navigation guard (US-CW-034 AC-02). The
 * provider that owns the state and renders the confirmation lives in navigation-guard.tsx; the
 * context and the JSX-free hooks live here so that file can export only its component (React Fast
 * Refresh requires a component file to export components exclusively).
 */
export type GuardedNavigate = (to: string, options?: NavigateOptions) => void;

export interface NavigationGuardValue {
  /** Live "there are unsaved changes" flag, set by the active form; read at click time, not render time. */
  blockRef: { current: boolean };
  guardedNavigate: GuardedNavigate;
}

export const NavigationGuardContext = createContext<NavigationGuardValue | null>(null);

/** Arms/disarms the guard for the current form. A no-op outside the provider. */
export function useRegisterNavigationGuard(active: boolean) {
  const ctx = useContext(NavigationGuardContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.blockRef.current = active;
    return () => {
      ctx.blockRef.current = false;
    };
  }, [ctx, active]);
}

/**
 * The navigation function the app's nav surfaces should use so an unsaved-changes guard can intercept.
 * Falls back to a plain navigate outside the provider, so isolated tests and non-guarded surfaces work
 * unchanged.
 */
export function useGuardedNavigate(): GuardedNavigate {
  const ctx = useContext(NavigationGuardContext);
  const navigate = useNavigate();
  const fallback = useCallback<GuardedNavigate>((to, options) => navigate(to, options), [navigate]);
  return ctx?.guardedNavigate ?? fallback;
}
