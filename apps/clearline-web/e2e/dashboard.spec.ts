import { expect, test } from './support/fixtures';
import { DEMO_EMAIL, DEMO_PASSWORD, expectSignedIn, fillLoginForm } from './support/helpers';

// The demo account seeds as a Finance Manager, whose role-based home is the spend dashboard
// (US-CW-001/US-CW-015). These specs drive US-CW-015's dashboard against the seeded June 2026 data.
async function signIn(page: Parameters<typeof fillLoginForm>[0]) {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('shows spend broken down by category, department and vendor, with an anomaly flag (AC-01/AC-02)', async ({
  page,
}) => {
  await signIn(page);

  await expect(page.getByText(/All departments/)).toBeVisible();
  // Breakdowns across all three dimensions render from the seeded June data.
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
  await expect(page.getByText('Gusto').first()).toBeVisible();

  // The anomalous WeWork charge is flagged by icon + text + AI confidence — never colour alone.
  await expect(page.getByText('Unusual amount')).toBeVisible();
  await expect(page.getByText(/AI 87% confidence/)).toBeVisible();
});

test('an empty date range shows an empty state, not an error (AC-03)', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();

  // A July range matches no seeded transactions.
  await page.getByLabel('Start date').fill('2026-07-01');
  await page.getByLabel('End date').fill('2026-07-07');
  await page.getByRole('button', { name: 'Apply range' }).click();

  await expect(page.getByText('No transactions in this date range')).toBeVisible();
  const reset = page.getByRole('button', { name: /Reset to June 2026/ });
  await expect(reset).toBeVisible();

  // Resetting returns to the populated month.
  await reset.click();
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();
});

test('an end-before-start range shows an inline error and is not applied (AC-04)', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();

  await page.getByLabel('Start date').fill('2026-06-30');
  await page.getByLabel('End date').fill('2026-06-12');

  await expect(page.getByText('End date must be after the start date.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply range' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  // The range was never applied — the seeded data is still shown.
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();
});

test('a single failing section is isolated with a scoped retry while the rest renders (AC-05)', async ({
  page,
  mockBackend,
}) => {
  await signIn(page);
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();

  // Break only the Top vendors endpoint; invalidation refetches it into its error state.
  await mockBackend.setAnalyticsSectionFailureForE2E('top-vendors', true);

  await expect(page.getByText("This section couldn't load.")).toBeVisible();
  // Every other section is unaffected by the isolated failure.
  await expect(page.getByText('Payroll & Benefits', { exact: true })).toBeVisible();
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible();

  // The scoped Retry affordance is present on the failed section.
  await expect(page.getByRole('button', { name: /Retry/ })).toBeVisible();

  // Recover: once the backend is healthy again, the section re-fetches back to its normal state.
  await mockBackend.setAnalyticsSectionFailureForE2E('top-vendors', false);
  await expect(page.getByText("This section couldn't load.")).toHaveCount(0);
});
