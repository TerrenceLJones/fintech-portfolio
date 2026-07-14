/**
 * Maps the Beacon's design-system-agnostic `--beacon-*` custom properties onto Clearline's `--cl-*`
 * tokens, so the widget picks up the app's light/dark theme without the lib ever importing the
 * design system. Passed to `<DemoBeaconProvider theme={...}>`. Any var left unmapped falls back to
 * the lib's own sensible default.
 */
export const BEACON_THEME: Record<string, string> = {
  '--beacon-accent': 'var(--cl-accent)',
  '--beacon-accent-contrast': '#ffffff',
  '--beacon-accent-weak': 'var(--cl-accent-weak)',
  '--beacon-surface': 'var(--cl-surface)',
  '--beacon-text': 'var(--cl-text)',
  '--beacon-text-2': 'var(--cl-text-2)',
  '--beacon-muted': 'var(--cl-text-3)',
  '--beacon-border': 'var(--cl-border)',
  '--beacon-inset': 'var(--cl-inset)',
  '--beacon-inset-2': 'var(--cl-surface-2)',
  '--beacon-danger': 'var(--cl-crit)',
  '--beacon-danger-weak': 'var(--cl-crit-weak)',
  '--beacon-focus': 'var(--cl-focus)',
  '--beacon-font': 'var(--font-cl-ui)',
  '--beacon-mono': 'var(--font-cl-mono)',
  '--beacon-radius': 'var(--radius-cl-2xl, 16px)',
};
