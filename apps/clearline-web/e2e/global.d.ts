// Single source of truth for the e2e-only control surface main.tsx exposes on window (only in
// DEV mode — see src/main.tsx), wrapped by support/fixtures.ts's `mockBackend` fixture and driven
// via page.evaluate() from there. Kept here rather than duplicated across spec files so they can't
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
      /** Mints a valid sign-up verification token for `email`/`password`, standing in for the link a real inbox would receive. */
      issueVerificationTokenForE2E: (
        email: string,
        password: string,
      ) => Promise<string | undefined>;
      /** Same, but backdated past the 24-hour TTL so it's already expired on arrival. */
      issueExpiredVerificationTokenForE2E: (
        email: string,
        password: string,
      ) => Promise<string | undefined>;
      /** Backdates `email`'s active access token(s) so the next session check reports them expired — US-CW-002 AC-01. */
      expireAccessTokenForE2E: (email: string) => void;
      /** Overrides POST /api/auth/refresh's outcome — see browser.ts for why a real cookie round-trip can't be exercised here (US-CW-002 AC-01/AC-02/AC-03/AC-06). `email` is only used for 'success', to mint a token the account's session check will actually recognize. */
      simulateRefreshOutcomeForE2E: (
        outcome: 'success' | 'reused' | 'expired' | 'password_changed',
        email: string,
      ) => void;
    };
  }
}
