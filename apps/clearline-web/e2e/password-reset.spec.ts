import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  expectSignedIn,
  fillLoginForm,
  navigateSpa,
  waitForApiResponse,
} from './support/helpers';
import type { Page } from '@playwright/test';

const NEW_PASSWORD = 'New-Horse-Battery-2';

async function requestReset(page: Page, email: string) {
  await page.goto('/forgot-password');
  const response = waitForApiResponse(page, '/api/auth/forgot-password');
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await response;
}

/** Mints a token via the e2e-only hook and navigates straight to the reset-password page with
 * it — standing in for the user clicking the link from their inbox (see browser.ts). */
async function goToResetLink(page: Page, email: string) {
  // Any app route first — __e2eMockBackend is wired up during main.tsx's bootstrap, which hasn't
  // run yet on Playwright's default about:blank starting page.
  await page.goto('/login');
  await page.waitForFunction(() => window.__e2eMockBackend !== undefined);
  const token = await page.evaluate(
    (targetEmail) => window.__e2eMockBackend!.issueResetTokenForE2E(targetEmail),
    email,
  );
  await navigateSpa(page, `/reset-password?token=${token}`);
}

test.describe('Password reset', () => {
  test('requesting a reset link shows the identical confirmation for a registered and an unregistered email (AC-01)', async ({
    page,
  }) => {
    await requestReset(page, DEMO_EMAIL);
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(
      page.getByText(
        "If that email is registered, we've sent a reset link. It's valid for 1 hour.",
      ),
    ).toBeVisible();

    await requestReset(page, 'not-a-real-user@clearline.dev');
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(
      page.getByText(
        "If that email is registered, we've sent a reset link. It's valid for 1 hour.",
      ),
    ).toBeVisible();
  });

  test('the "Forgot password?" link on the login page reaches the request form', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByLabel('Work email')).toBeVisible();
  });

  test('a missing or unknown reset token shows the expired-link notice with a resend affordance (AC-02)', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=not-a-real-token');

    await expect(page.getByText('This link has expired')).toBeVisible();
    await expect(
      page.getByText('Reset links are valid for 1 hour. Request a new one to continue.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Resend link' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('a reset link older than 1 hour shows the expired-link notice (AC-02)', async ({
    page,
    mockBackend,
  }) => {
    const token = await mockBackend.issueExpiredResetTokenForE2E(DEMO_EMAIL);
    await navigateSpa(page, `/reset-password?token=${token}`);

    await expect(page.getByText('This link has expired')).toBeVisible();
  });

  test('setting a new password from a valid link updates it, revokes the old one, and signs in with the new one (AC-03)', async ({
    page,
  }) => {
    // Prove the old password works before the reset, so the later 401 is meaningfully "revoked"
    // rather than "was never valid".
    await page.goto('/login');
    await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expectSignedIn(page);

    await goToResetLink(page, DEMO_EMAIL);
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText('Your password was changed. Sign in with your new password.'),
    ).toBeVisible();

    // the old password no longer works
    await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');

    // the new password does
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expectSignedIn(page);
  });

  test('a reused reset token is rejected after its first successful use (AC-03)', async ({
    page,
  }) => {
    await goToResetLink(page, DEMO_EMAIL);
    const usedToken = new URL(page.url()).searchParams.get('token');

    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await navigateSpa(page, `/reset-password?token=${usedToken}`);
    await expect(page.getByText('This link has expired')).toBeVisible();
  });

  test('a password failing complexity requirements is rejected inline without leaving the page (AC-03, edge case)', async ({
    page,
  }) => {
    await goToResetLink(page, DEMO_EMAIL);
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

    await page.getByLabel('New password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm new password').fill('weak');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(
      page.getByText(
        'Password must be at least 10 characters and include an uppercase letter, a lowercase letter, and a number.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('mismatched passwords are blocked inline without hitting the network (edge case)', async ({
    page,
  }) => {
    await goToResetLink(page, DEMO_EMAIL);
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill('Different-Battery-9');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });
});
