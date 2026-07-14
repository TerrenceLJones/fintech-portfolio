import { Suspense, lazy, useCallback, useMemo, useReducer, useRef } from 'react';
import type { DemoBeaconPageConfig, DemoBeaconProviderProps } from '../types';
import { DemoBeaconContext, type DemoBeaconContextValue } from './context';

// The launcher/panel UI is the only heavy part (Radix + section renderers). Lazy so it code-splits
// into its own chunk and is fetched only when the Beacon is enabled — a non-demo build never loads
// it. The registration store below is tiny and always present, so pages can register regardless.
const BeaconUI = lazy(() => import('../ui/BeaconUI').then((m) => ({ default: m.BeaconUI })));

interface Entry {
  handle: number;
  config: DemoBeaconPageConfig;
}

type Action =
  | { type: 'register'; handle: number; config: DemoBeaconPageConfig }
  | { type: 'update'; handle: number; config: DemoBeaconPageConfig }
  | { type: 'unregister'; handle: number };

function reducer(state: Entry[], action: Action): Entry[] {
  switch (action.type) {
    case 'register': {
      // Dedupe by pageId — re-registering a page replaces its entry rather than stacking a
      // duplicate; the new entry lands on top and becomes active.
      const withoutPage = state.filter((e) => e.config.pageId !== action.config.pageId);
      return [...withoutPage, { handle: action.handle, config: action.config }];
    }
    case 'update':
      return state.map((e) => (e.handle === action.handle ? { ...e, config: action.config } : e));
    case 'unregister':
      return state.filter((e) => e.handle !== action.handle);
    default:
      return state;
  }
}

/**
 * Mount once at the app shell. Owns the registration store (a stack — last-registered page wins, so
 * a leaf page overrides a layout-level config while mounted and the layout resurfaces when the leaf
 * unmounts). Renders `children` immediately; the launcher/panel mount only when `enabled`.
 */
export function DemoBeaconProvider({
  appName,
  enabled = true,
  position = 'bottom-right',
  offset = { x: 24, y: 24 },
  onNavigate,
  fallback,
  theme,
  children,
}: DemoBeaconProviderProps) {
  const [entries, dispatch] = useReducer(reducer, []);
  const nextHandle = useRef(1);

  const register = useCallback((config: DemoBeaconPageConfig) => {
    const handle = nextHandle.current++;
    dispatch({ type: 'register', handle, config });
    return handle;
  }, []);

  const update = useCallback((handle: number, config: DemoBeaconPageConfig) => {
    dispatch({ type: 'update', handle, config });
  }, []);

  const unregister = useCallback((handle: number) => {
    dispatch({ type: 'unregister', handle });
  }, []);

  const activeConfig = entries.length ? entries[entries.length - 1]!.config : (fallback ?? null);

  const value = useMemo<DemoBeaconContextValue>(
    () => ({ enabled, register, update, unregister, activeConfig, onNavigate }),
    [enabled, register, update, unregister, activeConfig, onNavigate],
  );

  return (
    <DemoBeaconContext.Provider value={value}>
      {children}
      {enabled ? (
        <Suspense fallback={null}>
          <BeaconUI appName={appName} position={position} offset={offset} theme={theme} />
        </Suspense>
      ) : null}
    </DemoBeaconContext.Provider>
  );
}
