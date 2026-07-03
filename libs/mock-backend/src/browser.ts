// MSW v2 browser worker entry point (dev server / Storybook).
import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth.handlers';

export const worker = setupWorker(...authHandlers);

/**
 * Test-only override for e2e coverage of AC-05 (auth-service-unreachable retry/backoff) — see
 * apps/clearline-web/e2e/login.spec.ts. Only reachable via the window hook main.tsx wires up
 * behind import.meta.env.DEV, so it never ships to production. Playwright's page.route() can't
 * intercept /api/auth/login itself: MSW's Service Worker answers it in-process without a real
 * network transaction, so there's nothing for CDP-level route interception to catch.
 */
export function simulateLoginFailure() {
  worker.use(
    http.post('*/api/auth/login', () =>
      HttpResponse.json({ error: 'internal_error' }, { status: 500 }),
    ),
  );
}
