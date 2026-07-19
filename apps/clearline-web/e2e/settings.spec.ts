import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  expectSignedIn,
  fillLoginForm,
  navigateSpa,
} from './support/helpers';

// US-CW-033 — the /settings shell and role-scoped SettingsNav. The demo account seeds as a Finance
// Manager; simulateRoleChangeForE2E stands in for an admin reassigning the role so one account can
// tour the Employee (Profile-only) and Controller (Profile + Organization) settings views.
async function signIn(page: Parameters<typeof fillLoginForm>[0]) {
  await page.goto('/login');
  await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectSignedIn(page);
}

const mainNav = (page: Parameters<typeof fillLoginForm>[0]) =>
  page.getByRole('navigation', { name: 'Main' });
const settingsNav = (page: Parameters<typeof fillLoginForm>[0]) =>
  page.getByRole('navigation', { name: 'Settings' });

test('every authenticated user has a Settings entry that lands on Personal Info (AC-01)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, { role: 'employee', approvalLimit: null });
  await signIn(page);

  await mainNav(page).getByText('Settings').click();

  await expect(page.getByRole('heading', { name: 'Personal Info' })).toBeVisible();
  await expect(settingsNav(page).getByRole('group', { name: 'Profile' })).toBeVisible();
});

test('an Employee never sees the Organization group in SettingsNav (AC-02)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, { role: 'employee', approvalLimit: null });
  await signIn(page);
  await navigateSpa(page, '/settings/personal');

  await expect(settingsNav(page).getByRole('group', { name: 'Profile' })).toBeVisible();
  await expect(settingsNav(page).getByRole('group', { name: 'Organization' })).toHaveCount(0);
  await expect(settingsNav(page).getByRole('link', { name: 'Billing & Plan' })).toHaveCount(0);
});

test('an Employee deep-linking an Organization settings route hits access-denied + an independent 403 (AC-04)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, { role: 'employee', approvalLimit: null });
  await signIn(page);

  await navigateSpa(page, '/settings/billing');

  await expect(page.getByText("You don't have access to this")).toBeVisible();
  await expect(page.getByText('403 Forbidden · GET /api/settings/sections/billing')).toBeVisible();
});

test('a Controller sees the Organization group and can switch sections without a reload (AC-03/AC-05)', async ({
  page,
  mockBackend,
}) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, {
    role: 'controller',
    approvalLimit: null,
  });
  await signIn(page);

  await mainNav(page).getByText('Settings').click();

  await expect(settingsNav(page).getByRole('group', { name: 'Organization' })).toBeVisible();
  await settingsNav(page).getByRole('link', { name: 'Company Profile' }).click();

  await expect(page.getByRole('heading', { name: 'Company Profile' })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/company/);
});

test('an unknown settings section shows the in-shell not-found', async ({ page, mockBackend }) => {
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, {
    role: 'controller',
    approvalLimit: null,
  });
  await signIn(page);

  await navigateSpa(page, '/settings/not-a-real-section');

  await expect(page.getByRole('heading', { name: 'Section not found' })).toBeVisible();
  await expect(settingsNav(page)).toBeVisible();
});

test('an Admin reaches Team & Members inside Settings, at /settings/team (relocated from /team)', async ({
  page,
  mockBackend,
}) => {
  // team:view is granted by the Admin flag; a plain Controller would not see this item.
  await mockBackend.simulateRoleChangeForE2E(DEMO_EMAIL, {
    role: 'controller',
    approvalLimit: null,
    isAdmin: true,
  });
  await signIn(page);

  await mainNav(page).getByText('Settings').click();
  const teamLink = settingsNav(page).getByRole('link', { name: 'Team & Members' });
  await expect(teamLink).toBeVisible();

  await teamLink.click();

  await expect(page).toHaveURL(/\/settings\/team/);
  await expect(teamLink).toHaveAttribute('aria-current', 'page');
});
