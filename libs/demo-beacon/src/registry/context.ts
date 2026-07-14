import { createContext } from 'react';
import type { DemoBeaconPageConfig } from '../types';

/** What the provider exposes to `useDemoBeacon` and the UI. */
export interface DemoBeaconContextValue {
  enabled: boolean;
  /** Register a page config; returns a handle used to unregister. */
  register: (config: DemoBeaconPageConfig) => number;
  /** Update an existing registration in place (config identity changed for the same handle). */
  update: (handle: number, config: DemoBeaconPageConfig) => void;
  unregister: (handle: number) => void;
  /** The config currently in effect: top of the registration stack, else the fallback, else null. */
  activeConfig: DemoBeaconPageConfig | null;
  onNavigate?: (path: string) => void;
}

/**
 * Null when no provider is mounted. `useDemoBeacon` treats that as a no-op, so pages can call the
 * hook unconditionally and a non-demo build (no provider) simply ignores it.
 */
export const DemoBeaconContext = createContext<DemoBeaconContextValue | null>(null);
