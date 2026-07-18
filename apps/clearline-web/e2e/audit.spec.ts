import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  expectSignedIn,
  fillLoginForm,
  navigateSpa,
} from './support/helpers';

// The demo account seeds as a Finance Manager; simulateRoleChangeForE2E stands in for an admin
// reassigning the role so one account can tour the Controller-only audit log (US-CW-021 / US-CW-006).
async function signIn(page: Parameters<typeof fillLoginForm>[0]) {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
}

test('a Controller sees the append-only log and their own access recorded at the top (AC-05/AC-06)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, {
    role: 'controller',
    approvalLimit: null,
  });
  await signIn(page);
  await navigateSpa(page, '/audit');

  // The immutability assurance and the seeded cross-cutting events are present.
  await expect(page.getByText('Append-only · cannot be edited or deleted')).toBeVisible();
  await expect(page.getByText('Froze card')).toBeVisible();
  await expect(page.getByText('Approved expense')).toBeVisible();

  // Opening the view is itself logged — a "Viewed audit log" access row is present (AC-06).
  await expect(page.getByText('Viewed audit log').first()).toBeVisible();
  await expect(page.getByText('access recorded').first()).toBeVisible();
});

test('an Employee navigating directly to /audit hits access-denied — never a limited view (AC-06)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, { role: 'employee', approvalLimit: null });
  await signIn(page);

  // The Audit Log nav item is capability-gated on audit:view, which an Employee lacks.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByText('Audit Log')).toHaveCount(0);

  // The route is guarded independently of the nav, and the server rejects the read with a 403.
  await navigateSpa(page, '/audit');
  await expect(page.getByText("You don't have access to this")).toBeVisible();
  await expect(page.getByText('403 Forbidden · GET /api/audit-log')).toBeVisible();
});
