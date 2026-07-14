/**
 * Whether this build runs against the MSW mock backend and should expose demo affordances (the
 * mock-backend worker, the e2e/demo control hooks on `window`, and the on-screen demo guide).
 *
 * True automatically in local dev (`import.meta.env.DEV`), and additionally when a build sets
 * `VITE_ENABLE_MOCKS=true` — that's the switch a hosted, stakeholder-facing demo deploy flips so
 * viewers get the same self-contained, backend-free experience without a `dev` server. A normal
 * production build leaves it unset, so none of the demo/mock code path is reachable there.
 */
export function demoModeEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true';
}
