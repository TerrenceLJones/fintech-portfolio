import { useContext, useEffect, useRef } from 'react';
import type { DemoBeaconPageConfig } from '../types';
import { DemoBeaconContext } from './context';

/**
 * Register this page's Beacon config for as long as the calling component is mounted. Registers on
 * mount, updates in place when `config` identity changes, unregisters on unmount.
 *
 * Safe to call unconditionally: with no provider mounted (a non-demo build) or with the Beacon
 * disabled, it's a no-op. Memoize `config` (e.g. `useMemo`) so it isn't re-registered every render.
 */
export function useDemoBeacon(config: DemoBeaconPageConfig): void {
  const ctx = useContext(DemoBeaconContext);
  const handleRef = useRef<number | null>(null);

  const active = ctx?.enabled ?? false;
  const register = ctx?.register;
  const update = ctx?.update;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!active || !register || !unregister) return;
    const handle = register(config);
    handleRef.current = handle;
    return () => {
      unregister(handle);
      handleRef.current = null;
    };
    // Register once per mount; config-identity changes are handled by the update effect below so a
    // changed config doesn't tear down and re-add (which would reorder the stack / reset the panel).
    // `config` is intentionally excluded from the deps here for that reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, register, unregister]);

  useEffect(() => {
    if (!active || !update || handleRef.current === null) return;
    update(handleRef.current, config);
  }, [active, update, config]);
}
