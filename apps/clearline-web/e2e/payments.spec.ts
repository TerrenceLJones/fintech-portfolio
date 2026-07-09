import { expect, test } from './support/fixtures';
import { DEMO_EMAIL, DEMO_PASSWORD, expectSignedIn, fillLoginForm } from './support/helpers';

// The demo account seeds as a Finance Manager, which carries payments:create (EPIC-CW-004), so it can
// reach the New Payment form and submit a vendor payment end-to-end against the MSW mock backend.
async function signIn(page: Parameters<typeof fillLoginForm>[0]) {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
}

test('submits a vendor payment (pessimistic pending), then reflects a reversal (US-CW-007/009)', async ({
  page,
  mockBackend,
}) => {
  await signIn(page);

  // Navigate to the New Payment form via the role-scoped nav.
  await page.getByRole('navigation', { name: 'Main' }).getByText('Payments').click();
  await expect(page).toHaveURL(/\/payments\/new$/);

  // Choose a verified recipient and enter an in-balance, in-limit amount.
  await page.getByRole('button', { name: /Acme Corp/ }).click();
  await page.getByLabel('Amount').fill('5000');
  await page.getByRole('button', { name: /Review & send/ }).click();

  // Irreversible confirm dialog — the "Send payment" label only appears once the countdown arms it,
  // so this waits out the pessimistic countdown rather than confirming instantly.
  await expect(page.getByText('Send $5,000.00 to Acme Corp?')).toBeVisible();
  await page.getByRole('button', { name: 'Send payment' }).click();

  // Lands on the status page in a pending "Processing…" state — never an instant success.
  await expect(page).toHaveURL(/\/payments\/pi_/);
  await expect(page.getByText('Pending')).toBeVisible();
  await expect(page.getByText(/We'll update this as it settles/)).toBeVisible();

  // The bank's reversal webhook (stood in for by the e2e control) posts a reversing entry; the open
  // status page reflects it once the payments cache is invalidated (US-CW-009 AC-02).
  const intentId = new URL(page.url()).pathname.split('/').pop() ?? '';
  await mockBackend.simulatePaymentReversalForE2E(intentId);

  await expect(page.getByText('Reversed', { exact: true })).toBeVisible();
  await expect(page.getByText(/The funds were returned to your account/)).toBeVisible();
});

test('blocks a self-transfer before any network call (US-CW-008 AC-05)', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Main' }).getByText('Payments').click();

  // The demo source account also appears as a payable recipient (••4021) — paying it is a self-transfer.
  await page.getByRole('button', { name: /Operating/ }).click();
  await page.getByLabel('Amount').fill('100');
  await page.getByRole('button', { name: /Review & send/ }).click();

  await expect(page.getByText("You can't transfer to the same account.")).toBeVisible();
  // No confirm dialog opened — the submit was blocked client-side.
  await expect(page.getByText(/can't be undone/)).toHaveCount(0);
});
