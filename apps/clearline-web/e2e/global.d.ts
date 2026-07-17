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
      /** Changes the signed-in account's role/limit/admin flag in place, standing in for an admin reassignment — the next session refetch reflects it without a re-login (US-CW-006 AC-05). */
      simulateRoleChangeForE2E: (
        email: string,
        patch: {
          role?: 'employee' | 'finance_manager' | 'controller';
          approvalLimit?: number | null;
          isAdmin?: boolean;
          isOwner?: boolean;
        },
      ) => void;
      /** Posts an additive reversing ledger entry against a payment and flips it to "Reversed", standing in for the bank's reversal webhook (US-CW-009 AC-02). */
      simulatePaymentReversalForE2E: (intentId: string) => void;
      /** Arms/disarms a single spend-dashboard section's simulated 500 so its isolated error + scoped retry can be exercised (US-CW-015 AC-05). Invalidates analytics so the section refetches without a reload. */
      setAnalyticsSectionFailureForE2E: (
        section:
          'summary' | 'spend-by-category' | 'by-department' | 'top-vendors' | 'recent-activity',
        armed: boolean,
      ) => void;
      /** Arms/disarms a reconciliation panel's simulated 500 so its isolated error + scoped retry can be exercised (US-CW-016 AC-05). Invalidates reconciliation so the panel refetches without a reload. */
      setReconciliationSectionFailureForE2E: (
        section: 'summary' | 'exceptions' | 'matched' | 'balance',
        armed: boolean,
      ) => void;
      /** Arms/disarms the ledger balance-integrity discrepancy so the Fatal-tier withheld-balance state can be exercised (US-CW-016 AC-04). Invalidates reconciliation so the balance panel refetches. */
      setReconciliationBalanceFailureForE2E: (armed: boolean) => void;
      /** Re-runs the nightly reconciliation and invalidates reconciliation so every panel reflects the fresh run. */
      runReconciliationForE2E: () => void;
    };
  }
}
