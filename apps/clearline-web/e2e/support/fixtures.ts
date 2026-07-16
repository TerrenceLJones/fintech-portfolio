import { test as base } from '@playwright/test';

// Window.__e2eMockBackend's shape lives in ../global.d.ts, the single source of truth shared with
// src/main.tsx.
export type MockBackend = NonNullable<Window['__e2eMockBackend']>;

export const test = base.extend<{ mockBackend: MockBackend }>({
  // Fixtures are lazy — this only runs (navigating to /login and waiting for the e2e-only hook)
  // for tests that actually declare `mockBackend`, so specs that don't need it are unaffected.
  mockBackend: async ({ page }, use) => {
    // Any app route first — __e2eMockBackend is wired up during main.tsx's bootstrap, which
    // hasn't run yet on Playwright's default about:blank starting page. It's attached
    // asynchronously during bootstrap (after worker.start() resolves), which lands after
    // page.goto() considers navigation complete, so wait for it rather than assuming it's there.
    await page.goto('/login');
    await page.waitForFunction(() => window.__e2eMockBackend !== undefined);

    await use({
      simulateLoginFailure: () =>
        page.evaluate(() => window.__e2eMockBackend!.simulateLoginFailure()),
      issueResetTokenForE2E: (email) =>
        page.evaluate((e) => window.__e2eMockBackend!.issueResetTokenForE2E(e), email),
      issueExpiredResetTokenForE2E: (email) =>
        page.evaluate((e) => window.__e2eMockBackend!.issueExpiredResetTokenForE2E(e), email),
      issueVerificationTokenForE2E: (email, password) =>
        page.evaluate(
          ({ email, password }) =>
            window.__e2eMockBackend!.issueVerificationTokenForE2E(email, password),
          { email, password },
        ),
      issueExpiredVerificationTokenForE2E: (email, password) =>
        page.evaluate(
          ({ email, password }) =>
            window.__e2eMockBackend!.issueExpiredVerificationTokenForE2E(email, password),
          { email, password },
        ),
      expireAccessTokenForE2E: (email) =>
        page.evaluate((e) => window.__e2eMockBackend!.expireAccessTokenForE2E(e), email),
      simulateRefreshOutcomeForE2E: (outcome, email) =>
        page.evaluate(
          ({ outcome, email }) =>
            window.__e2eMockBackend!.simulateRefreshOutcomeForE2E(outcome, email),
          { outcome, email },
        ),
      simulateRoleChangeForE2E: (email, patch) =>
        page.evaluate(
          ({ email, patch }) => window.__e2eMockBackend!.simulateRoleChangeForE2E(email, patch),
          { email, patch },
        ),
      simulatePaymentReversalForE2E: (intentId) =>
        page.evaluate((id) => window.__e2eMockBackend!.simulatePaymentReversalForE2E(id), intentId),
      setAnalyticsSectionFailureForE2E: (section, armed) =>
        page.evaluate(
          ({ section, armed }) =>
            window.__e2eMockBackend!.setAnalyticsSectionFailureForE2E(section, armed),
          { section, armed },
        ),
    });
  },
});

export { expect } from '@playwright/test';
