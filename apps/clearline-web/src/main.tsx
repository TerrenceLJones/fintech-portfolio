import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setDocumentTextRecognizer } from '@clearline/data-access-onboarding';
import { App } from './App';
import { mockDocumentOcr } from './dev/mock-document-ocr';
import { demoModeEnabled } from './dev/demo-mode';

// Window.__e2eMockBackend's type lives in e2e/global.d.ts, shared with login.spec.ts's AC-05 test
// and password-reset.spec.ts.

async function bootstrap() {
  const queryClient = new QueryClient();

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
      expireAccessTokenForE2E,
      simulateRefreshOutcomeForE2E,
      simulateRoleChangeForE2E,
      simulatePaymentReversalForE2E,
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
