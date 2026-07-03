import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

// Window.__e2eMockBackend's type lives in e2e/global.d.ts, shared with login.spec.ts's AC-05 test
// and password-reset.spec.ts.

async function bootstrap() {
  if (import.meta.env.DEV) {
    // Dynamic import so the MSW browser-worker code never ships in a production build.
    const { worker, simulateLoginFailure, issueResetTokenForE2E, issueExpiredResetTokenForE2E } =
      await import('@fintech-portfolio/mock-backend/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
    // e2e-only control surface (apps/clearline-web/e2e/login.spec.ts AC-05,
    // apps/clearline-web/e2e/password-reset.spec.ts) — Playwright drives this via
    // page.evaluate() since it can't intercept MSW's Service Worker-mocked requests.
    window.__e2eMockBackend = {
      simulateLoginFailure,
      issueResetTokenForE2E,
      issueExpiredResetTokenForE2E,
    };
  }

  const queryClient = new QueryClient();
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
