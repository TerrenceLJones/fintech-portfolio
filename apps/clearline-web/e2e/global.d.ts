// Single source of truth for the e2e-only control surface main.tsx exposes on window (only in
// DEV mode — see src/main.tsx) and login.spec.ts's AC-05 test drives via page.evaluate(). Kept
// here rather than duplicated in both files so the two can't independently drift out of sync.
export {};

declare global {
  interface Window {
    __e2eMockBackend?: { simulateLoginFailure: () => void };
  }
}
