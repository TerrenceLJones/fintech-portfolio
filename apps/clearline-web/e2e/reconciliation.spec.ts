import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  expectSignedIn,
  fillLoginForm,
  navigateSpa,
} from './support/helpers';

// The demo account seeds as a Finance Manager, who holds reconciliation:view (US-CW-006). These specs
// drive US-CW-016's bank-feed reconciliation against the seeded exceptions queue.
async function signInAndOpen(page: Parameters<typeof fillLoginForm>[0]) {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
  await navigateSpa(page, '/reconciliation');
  // The run caption is unique to this page (the "Reconciliation" heading collides with the shell's h1).
  await expect(page.getByText(/Nightly job/)).toBeVisible();
}

test('shows the run summary and the exceptions queue with actionable, labelled statuses (AC-01/AC-02)', async ({
  page,
}) => {
  await signInAndOpen(page);

  await expect(page.getByText('Auto-matched')).toBeVisible();
  await expect(page.getByText('Match rate')).toBeVisible();

  // The seeded exceptions are surfaced, each kept actionable rather than hidden.
  await expect(page.getByText('ABC Corp', { exact: true })).toBeVisible();
  await expect(page.getByText('Stripe Payout')).toBeVisible();
  // Status is an icon + label (or a labelled score pill), never colour alone.
  await expect(page.getByText('Unmatched').first()).toBeVisible();
  await expect(page.getByText(/% match/).first()).toBeVisible();
});

test('confirms a fuzzy suggestion against its similarity breakdown, clearing it from the queue (AC-03)', async ({
  page,
}) => {
  await signInAndOpen(page);
  await expect(page.getByText('ABC Corp', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Review' }).first().click();

  await expect(page.getByText(/% similarity/)).toBeVisible();
  await expect(page.getByText('Suggested match')).toBeVisible();
  await page.getByRole('button', { name: /Confirm match/ }).click();

  // Confirming reconciles it — the suggestion drops off the queue.
  await expect(page.getByText('ABC Corp', { exact: true })).toHaveCount(0);
});

test('validates a split sums exactly before it can be confirmed (AC-05)', async ({ page }) => {
  await signInAndOpen(page);
  await page.getByRole('button', { name: 'Split' }).first().click();

  await expect(page.getByRole('heading', { name: 'Split match' })).toBeVisible();

  // Break the balance — the error shows and Confirm is disabled.
  await page.getByLabel('Amount for INV-20419 · Meridian Supply').fill('1000');
  await expect(
    page.getByText('The split amounts must add up to the full transaction amount.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirm split match/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  // Fix it — the strip balances and Confirm commits the split.
  await page.getByLabel('Amount for INV-20419 · Meridian Supply').fill('2000');
  await expect(page.getByText('Splits balance')).toBeVisible();
  await page.getByRole('button', { name: /Confirm split match/ }).click();
  await expect(page.getByText('Acme Wholesale')).toHaveCount(0);
});

test('withholds the balance behind a Fatal-tier notice when the ledger fails integrity (AC-04)', async ({
  page,
  mockBackend,
}) => {
  await signInAndOpen(page);
  // Healthy to start: the account balance renders.
  await expect(page.getByText(/available balance/)).toBeVisible();

  // Corrupt the ledger integrity; invalidation refetches the balance into its withheld state.
  await mockBackend.setReconciliationBalanceFailureForE2E(true);

  await expect(
    page.getByText("We're double-checking your balance. This may take a moment."),
  ).toBeVisible();
  await expect(page.getByText('REC-3B81-F009')).toBeVisible();
  await expect(page.getByText('Fatal-tier')).toBeVisible();

  // Recover once integrity is restored.
  await mockBackend.setReconciliationBalanceFailureForE2E(false);
  await expect(
    page.getByText("We're double-checking your balance. This may take a moment."),
  ).toHaveCount(0);
});

test('isolates a failing panel behind a scoped retry while the others render (AC-05 resilience)', async ({
  page,
  mockBackend,
}) => {
  await signInAndOpen(page);
  await expect(page.getByText('ABC Corp', { exact: true })).toBeVisible();

  await mockBackend.setReconciliationSectionFailureForE2E('exceptions', true);

  await expect(page.getByText("This section couldn't load.")).toBeVisible();
  // Summary panel is unaffected.
  await expect(page.getByText('Auto-matched')).toBeVisible();
  await expect(page.getByRole('button', { name: /Retry/ })).toBeVisible();

  await mockBackend.setReconciliationSectionFailureForE2E('exceptions', false);
  await expect(page.getByText("This section couldn't load.")).toHaveCount(0);
});
