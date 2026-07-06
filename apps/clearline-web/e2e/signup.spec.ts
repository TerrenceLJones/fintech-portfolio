import { expect, test, type Page } from '@playwright/test';

// Window.__e2eMockBackend's type lives in e2e/global.d.ts, shared with login.spec.ts and
// password-reset.spec.ts.

// Matches the seed user in libs/mock-backend/src/fixtures/users.fixture.ts
const DEMO_EMAIL = 'demo@clearline.dev';
const NEW_OWNER_EMAIL = 'new-owner@clearline.dev';
const VALID_PASSWORD = 'Correct-Horse-1';

/**
 * Changes the URL without a full page load, the way clicking an in-app `<Link>` would — see
 * password-reset.spec.ts for why this matters for a mock backend whose state lives only in the
 * running bundle (now persisted to sessionStorage too, but a full reload still isn't needed here).
 */
async function navigateSpa(page: Page, path: string) {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto('/signup');
  const response = page.waitForResponse(
    (res) => res.url().includes('/api/auth/signup') && res.request().method() === 'POST',
  );
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await response;
}

/**
 * Mints a token via the e2e-only hook and navigates straight to the verify page with it —
 * standing in for the user clicking the link from their inbox (see browser.ts). Returns the raw
 * token, since VerifyEmailPage auto-redirects away from `/verify?token=...` on success, so the
 * URL itself is not a reliable place to read the token back from afterward (unlike
 * reset-password, which stays put until form submission).
 */
async function goToVerifyLink(page: Page, email: string, password: string): Promise<string> {
  // Any app route first — __e2eMockBackend is wired up during main.tsx's bootstrap, which hasn't
  // run yet on Playwright's default about:blank starting page.
  await page.goto('/login');
  await page.waitForFunction(() => window.__e2eMockBackend !== undefined);
  const token = await page.evaluate(
    ({ targetEmail, targetPassword }) =>
      window.__e2eMockBackend!.issueVerificationTokenForE2E(targetEmail, targetPassword),
    { targetEmail: email, targetPassword: password },
  );
  await navigateSpa(page, `/verify?token=${token}`);
  return token!;
}

test.describe('Sign up', () => {
  test('signing up with an unregistered email shows the check-your-email confirmation (AC-01)', async ({
    page,
  }) => {
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);

    await expect(page.getByText('Check your email to verify your account')).toBeVisible();
    await expect(page.getByText(NEW_OWNER_EMAIL, { exact: false })).toBeVisible();
  });

  test('signing up with an email that is already registered shows the identical confirmation (AC-02)', async ({
    page,
  }) => {
    await signUp(page, DEMO_EMAIL, VALID_PASSWORD);

    await expect(page.getByText('Check your email to verify your account')).toBeVisible();
  });

  test('the "Already have an account? Log in" link on signup reaches the login page (AC-06)', async ({
    page,
  }) => {
    await page.goto('/signup');
    await page.getByText('Log in').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Work email')).toBeVisible();
  });

  test('the "Don\'t have an account? Sign up" link on the login page reaches the signup form (US-CW-001 AC-06)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByText('Sign up').click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByLabel('Work email')).toBeVisible();
  });

  test('a password failing complexity requirements keeps Create account disabled (AC-04)', async ({
    page,
  }) => {
    await page.goto('/signup');
    await page.getByLabel('Work email').fill(NEW_OWNER_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill('weak');

    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  test('clicking a valid verification link verifies the account and signs in automatically (AC-03)', async ({
    page,
  }) => {
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);
    await goToVerifyLink(page, NEW_OWNER_EMAIL, VALID_PASSWORD);

    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
    await expect(page.getByText('Welcome back.')).toBeVisible();
  });

  test('a verification link older than 24 hours shows the expired-link notice (AC-05)', async ({
    page,
  }) => {
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);

    await page.goto('/login');
    await page.waitForFunction(() => window.__e2eMockBackend !== undefined);
    const token = await page.evaluate(
      ({ targetEmail, targetPassword }) =>
        window.__e2eMockBackend!.issueExpiredVerificationTokenForE2E(targetEmail, targetPassword),
      { targetEmail: NEW_OWNER_EMAIL, targetPassword: VALID_PASSWORD },
    );
    await navigateSpa(page, `/verify?token=${token}`);

    await expect(page.getByText('This link has expired')).toBeVisible();
  });

  test('"Resend link" on an expired verification link returns to the signup form (AC-05)', async ({
    page,
  }) => {
    await page.goto('/verify?token=not-a-real-token');
    await expect(page.getByText('This link has expired')).toBeVisible();

    await page.getByRole('button', { name: 'Resend link' }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('a missing or unknown verification token shows the expired-link notice', async ({
    page,
  }) => {
    await page.goto('/verify?token=not-a-real-token');
    await expect(page.getByText('This link has expired')).toBeVisible();
  });

  test('a reused verification token is rejected after its first successful use (edge case)', async ({
    page,
  }) => {
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);
    const usedToken = await goToVerifyLink(page, NEW_OWNER_EMAIL, VALID_PASSWORD);
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);

    await navigateSpa(page, `/verify?token=${usedToken}`);
    await expect(page.getByText('This link has expired')).toBeVisible();
  });

  test('resubmitting sign-up for the same unverified email does not create a duplicate account (edge case)', async ({
    page,
  }) => {
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);
    await signUp(page, NEW_OWNER_EMAIL, VALID_PASSWORD);

    await goToVerifyLink(page, NEW_OWNER_EMAIL, VALID_PASSWORD);
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);

    // logging in afterward proves exactly one account exists with the submitted password. The
    // email-verification link above already auto-logged in (its own session is still active), so
    // this explicit login now surfaces US-CW-002 AC-07's concurrent-session notice rather than
    // navigating straight through — "Continue here" completes it the same way a real second
    // sign-in would.
    await navigateSpa(page, '/login');
    await page.getByLabel('Work email').fill(NEW_OWNER_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Continue here' }).click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
    await expect(page.getByText('Welcome back.')).toBeVisible();
  });
});
