import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  expectSignedIn,
  fillLoginForm,
  navigateSpa,
  waitForApiResponse,
} from './support/helpers';

// AC-04 (14-minute warning, 60-second grace, 15-minute cutoff) and AC-05 (any activity or "Stay
// signed in" resets it) are deliberately not covered here — there's no way to fast-forward a real
// browser's clock the way the mock backend's other e2e hooks backdate server-side state, and
// waiting out 14+ real minutes per test isn't a reasonable tradeoff for the coverage it'd add over
// the deterministic fake-timer tests already covering this exact logic (use-inactivity-timer.test.ts,
// SessionActivityBoundary.test.tsx).

/** React Query's default refetch-on-window-focus only listens for 'visibilitychange' on window (see
 * @tanstack/query-core's FocusManager) — dispatching it manually triggers a refetch without
 * needing an actual OS-level tab-focus change, which Playwright can't simulate directly anyway. */
async function triggerFocusRefetch(page: Parameters<typeof waitForApiResponse>[0]) {
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
}

test('an expired access token is silently refreshed and the request replayed, with no interruption (AC-01)', async ({
  page,
  mockBackend,
}) => {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
  await expect(page.getByText(`Signed in as ${DEMO_EMAIL}`)).toBeVisible();

  await mockBackend.expireAccessTokenForE2E(DEMO_EMAIL);
  await mockBackend.simulateRefreshOutcomeForE2E('success', DEMO_EMAIL);

  const refreshResponse = waitForApiResponse(page, '/api/auth/refresh');
  await triggerFocusRefetch(page);
  await refreshResponse;

  // still on the dashboard, no redirect and no visible interruption to the signed-in state
  await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
  await expect(page.getByText(`Signed in as ${DEMO_EMAIL}`)).toBeVisible();
});

test('a refresh rejected as reused ends the session everywhere, with a neutral security message (AC-02)', async ({
  page,
  mockBackend,
}) => {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);

  await mockBackend.expireAccessTokenForE2E(DEMO_EMAIL);
  await mockBackend.simulateRefreshOutcomeForE2E('reused', DEMO_EMAIL);

  const refreshResponse = waitForApiResponse(page, '/api/auth/refresh');
  await triggerFocusRefetch(page);
  await refreshResponse;

  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText('For your security, we signed you out. Please sign in again.'),
  ).toBeVisible();
});

test('a refresh rejected as expired ends the session and preserves the route to return to (AC-03)', async ({
  page,
  mockBackend,
}) => {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);

  await mockBackend.expireAccessTokenForE2E(DEMO_EMAIL);
  await mockBackend.simulateRefreshOutcomeForE2E('expired', DEMO_EMAIL);

  const refreshResponse = waitForApiResponse(page, '/api/auth/refresh');
  await triggerFocusRefetch(page);
  await refreshResponse;

  await expect(page).toHaveURL(/\/login\?next=%2F/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
});

test('a password change from another device ends this session on its next authenticated request (AC-06)', async ({
  page,
  mockBackend,
}) => {
  const NEW_PASSWORD = 'New-Horse-Battery-2';

  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);

  // Standing in for the reset happening from a different device — the account's whole refresh-
  // token family gets revoked, but nothing pushes that to this still-open tab in real time.
  const token = await mockBackend.issueResetTokenForE2E(DEMO_EMAIL);
  await navigateSpa(page, `/reset-password?token=${token}`);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Back on the dashboard route: DashboardPage's useSession() fires on this fresh mount and
  // discovers the family was revoked, without any focus/visibility trigger needed.
  const sessionResponse = waitForApiResponse(page, '/api/auth/session', 'GET');
  await navigateSpa(page, '/');
  await sessionResponse;

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Your session ended. Please sign in again.')).toBeVisible();
});

test('logging in again while a session is still active shows a non-destructive concurrent-session notice, without forcing the first device out (AC-07)', async ({
  page,
}) => {
  await page.goto('/login');
  const firstLoginResponse = waitForApiResponse(page, '/api/auth/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const { accessToken: firstAccessToken } = await (await firstLoginResponse).json();
  await expectSignedIn(page);

  // An SPA-style navigation (not a reload) — the running bundle, and with it the first login's
  // access token record, stays alive throughout, standing in for a second device logging in
  // without the first ever signing out.
  await navigateSpa(page, '/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText("You're signed in on another device. Continue here?")).toBeVisible();

  await page.getByRole('button', { name: 'Continue here' }).click();
  await expectSignedIn(page);

  // Proves "continuing here" really didn't force the other device out: the first login's own
  // access token — this tab has no memory of it anymore, so it's presented directly — is still
  // recognized as active by the very account whose second sign-in we just completed.
  const firstSessionStillActive = await page.evaluate(async (token) => {
    const response = await fetch('/api/auth/session', {
      headers: { authorization: `Bearer ${token}` },
    });
    return response.ok;
  }, firstAccessToken);
  expect(firstSessionStillActive).toBe(true);
});

test('cancelling the concurrent-session notice revokes the new session and stays on the login page (AC-07)', async ({
  page,
}) => {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);

  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("You're signed in on another device. Continue here?")).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("You're signed in on another device. Continue here?"),
  ).not.toBeVisible();
});
