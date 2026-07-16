import { expect, type Page } from '@playwright/test';

// Matches the seed user in libs/mock-backend/src/fixtures/users.fixture.ts
export const DEMO_EMAIL = 'demo@clearline.dev';
export const DEMO_PASSWORD = 'Correct-Horse-Battery-1';

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Work email').fill(email);
  // exact: true — otherwise this also matches the PasswordField's "Show password" toggle button,
  // whose aria-label contains "Password" as a substring (Playwright's getByLabel is substring
  // matching by default, unlike Testing Library's getByLabelText which is exact).
  await page.getByLabel('Password', { exact: true }).fill(password);
}

export function waitForApiResponse(page: Page, path: string, method = 'POST') {
  return page.waitForResponse(
    (res) => res.url().includes(path) && res.request().method() === method,
  );
}

/** Creates an account via the real sign-up form. Callers decide whether to verify it afterward. */
export async function signUp(page: Page, email: string, password: string) {
  await page.goto('/signup');
  const response = waitForApiResponse(page, '/api/auth/signup');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await response;
}

/**
 * Changes the URL without a full page load, the way clicking an in-app `<Link>` would — as
 * opposed to `page.goto()`, which reloads the page and, with it, the entire JS bundle. The mock
 * backend's `sharedAuthService` (including every issued reset/verification token) persists itself
 * to sessionStorage and rehydrates on construction, so a reload no longer loses that state either
 * — this is now just the lighter-weight of the two ways to land on a token-bearing route, not a
 * required workaround. React Router's BrowserRouter picks up a same-origin `pushState` +
 * `popstate` pair exactly as it would a real navigation.
 */
export async function navigateSpa(page: Page, path: string) {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

/**
 * Asserts a sign-in succeeded and landed inside the authenticated app shell. Role-agnostic: the
 * post-login landing is now role-based (US-CW-001) — Finance Managers/Controllers land on /dashboard
 * (US-CW-015), everyone else on /expenses — so this checks the app chrome is present rather than a
 * single home URL.
 */
export async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}
