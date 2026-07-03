// Single source of truth for the e2e-only control surface main.tsx exposes on window (only in
// DEV mode — see src/main.tsx), driven via page.evaluate() by login.spec.ts's AC-05 test and by
// password-reset.spec.ts. Kept here rather than duplicated in both files so the two can't
// independently drift out of sync.
export {};

declare global {
  interface Window {
    __e2eMockBackend?: {
      simulateLoginFailure: () => void;
      /** Mints a valid reset token for `email`, standing in for the link a real inbox would receive. */
      issueResetTokenForE2E: (email: string) => Promise<string | undefined>;
      /** Same, but backdated past the 1-hour TTL so it's already expired on arrival. */
      issueExpiredResetTokenForE2E: (email: string) => Promise<string | undefined>;
    };
  }
}
