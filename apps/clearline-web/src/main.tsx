import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  GETTING_STARTED_TASKS_QUERY_KEY,
  setDocumentTextRecognizer,
} from '@clearline/data-access-onboarding';
import { App } from './App';
import { mockDocumentOcr } from './dev/mock-document-ocr';
import { demoModeEnabled } from './dev/demo-mode';

// Window.__e2eMockBackend's type lives in e2e/global.d.ts, shared with login.spec.ts's AC-05 test
// and password-reset.spec.ts.

async function bootstrap() {
  // Any successful mutation may have completed a getting-started task server-side at its own call site
  // (an expense submitted, a card issued, an approval actioned…). Invalidating the launcher's read
  // model on every mutation success keeps its progress live (EPIC-CW-023 / US-CW-047) instead of
  // updating only on the next reload or window focus — the payload is tiny and only refetches while
  // the launcher is actually mounted. The Demo Beacon's raw-fetch shortcuts use a window event instead.
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: GETTING_STARTED_TASKS_QUERY_KEY });
      },
    }),
  });

  // True in local dev, and in a hosted demo build that sets VITE_ENABLE_MOCKS=true so
  // stakeholders/viewers get the same backend-free experience (see dev/demo-mode.ts).
  if (demoModeEnabled()) {
    // Dynamic import so the MSW browser-worker code never ships in a real production build.
    const {
      worker,
      simulateLoginFailure,
      issueResetTokenForE2E,
      issueExpiredResetTokenForE2E,
      issueVerificationTokenForE2E,
      issueExpiredVerificationTokenForE2E,
      issueEmailChangeTokenForE2E,
      issueExpiredEmailChangeTokenForE2E,
      expireAccessTokenForE2E,
      simulateRefreshOutcomeForE2E,
      simulateRoleChangeForE2E,
      simulatePaymentReversalForE2E,
      setAnalyticsSectionFailureForE2E,
      setReconciliationSectionFailureForE2E,
      setReconciliationBalanceFailureForE2E,
      runReconciliationForE2E,
    } = await import('@clearline/mock-backend/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
    // With the mock backend in play there's no real ID-verification vendor, so swap the browser
    // Tesseract.js recognizer for a deterministic double — keeps e2e fast and offline.
    setDocumentTextRecognizer(mockDocumentOcr);
    // e2e-only control surface (apps/clearline-web/e2e/login.spec.ts AC-05,
    // apps/clearline-web/e2e/password-reset.spec.ts, apps/clearline-web/e2e/signup.spec.ts,
    // apps/clearline-web/e2e/session.spec.ts) — Playwright drives this via page.evaluate() since
    // it can't intercept MSW's Service Worker-mocked requests.
    window.__e2eMockBackend = {
      simulateLoginFailure,
      issueResetTokenForE2E,
      issueExpiredResetTokenForE2E,
      issueVerificationTokenForE2E,
      issueExpiredVerificationTokenForE2E,
      issueEmailChangeTokenForE2E,
      issueExpiredEmailChangeTokenForE2E,
      expireAccessTokenForE2E,
      simulateRefreshOutcomeForE2E,
      simulateRoleChangeForE2E,
      // Reverse server-side, then invalidate every payments query so an open status page reflects
      // the reversal at once — the client stand-in for the reversal webhook's push (US-CW-009 AC-02),
      // rather than waiting for the next poll (a settled payment isn't polling at all).
      simulatePaymentReversalForE2E: (intentId: string) => {
        simulatePaymentReversalForE2E(intentId);
        void queryClient.invalidateQueries({ queryKey: ['payments'] });
      },
      // Arm/disarm a single dashboard section's simulated failure, then invalidate analytics so the
      // section refetches and shows (or clears) its isolated error without a reload (US-CW-015 AC-05).
      setAnalyticsSectionFailureForE2E: (section, armed) => {
        setAnalyticsSectionFailureForE2E(section, armed);
        void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      },
      // Arm/disarm a reconciliation panel's simulated failure, then invalidate so it refetches and
      // shows (or clears) its isolated error without a reload (US-CW-016 AC-05, mirrors analytics).
      setReconciliationSectionFailureForE2E: (section, armed) => {
        setReconciliationSectionFailureForE2E(section, armed);
        void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      },
      // Arm/disarm the ledger balance-integrity discrepancy, then invalidate so the balance panel
      // re-fetches into (or out of) the Fatal-tier withheld state without a reload (US-CW-016 AC-04).
      setReconciliationBalanceFailureForE2E: (armed) => {
        setReconciliationBalanceFailureForE2E(armed);
        void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      },
      // Re-run the nightly reconciliation, then invalidate so every panel reflects the fresh run.
      runReconciliationForE2E: () => {
        runReconciliationForE2E();
        void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      },
    };
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Missing #root element');

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

bootstrap().catch((error) => {
  // Without this, a rejection anywhere in bootstrap (e.g. MSW worker registration failing)
  // leaves the page blank with no on-screen indication that anything went wrong.
  console.error('Failed to start app:', error);
});
