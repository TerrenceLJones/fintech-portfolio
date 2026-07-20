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

// US-CW-034 — Personal Profile & Notification Preferences. The demo account (Finance Manager) is
// used as-is; the Profile group needs no special role. Navigation goes through the UI (clicking the
// Settings entry, then the section link) rather than a scripted pushState, so it can't race the
// post-login HomeRedirect.
async function openSettings(page: Parameters<typeof fillLoginForm>[0]) {
  await signIn(page);
  await mainNav(page).getByText('Settings').click();
  await expect(page.getByRole('heading', { name: 'Personal Info' })).toBeVisible();
}

test('Personal Info: editing the name raises the unsaved footer and saving confirms (AC-01/02)', async ({
  page,
}) => {
  await openSettings(page);

  const name = page.getByLabel('Full name');
  await expect(name).toHaveValue('Marcus Okafor');
  await name.fill('Marcus Okafor Jr.');

  const footer = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(footer).toBeVisible();
  await footer.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Profile updated')).toBeVisible();
  await expect(footer).toBeHidden();
});

test('Personal Info: requesting an email change shows the sent notice and a pending indicator (AC-03)', async ({
  page,
}) => {
  await openSettings(page);

  await page.getByLabel('New email').fill('marcus.new@clearline.dev');
  await page.getByRole('button', { name: 'Update email' }).click();

  await expect(
    page.getByText(/We've sent a confirmation link to marcus.new@clearline.dev/),
  ).toBeVisible();
  await expect(page.getByText('Pending: marcus.new@clearline.dev')).toBeVisible();
});

test('Personal Info: confirming the email-change link swaps the login email (AC-03/04)', async ({
  page,
  mockBackend,
}) => {
  await signIn(page);
  // No inbox in the demo — mint the confirmation-link token directly, as the Beacon action does.
  const token = await mockBackend.issueEmailChangeTokenForE2E(
    DEMO_EMAIL,
    'marcus.moved@clearline.dev',
  );
  expect(token).toBeTruthy();

  await navigateSpa(page, `/email-change/confirm?token=${token}`);

  await expect(page.getByRole('heading', { name: 'Email updated' })).toBeVisible();
  await expect(page.getByText(/marcus.moved@clearline.dev/)).toBeVisible();
});

test('Personal Info: an expired email-change link shows the expired screen (AC-04)', async ({
  page,
  mockBackend,
}) => {
  await signIn(page);
  const token = await mockBackend.issueExpiredEmailChangeTokenForE2E(
    DEMO_EMAIL,
    'marcus.stale@clearline.dev',
  );
  expect(token).toBeTruthy();

  await navigateSpa(page, `/email-change/confirm?token=${token}`);

  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
});

test('Notifications: toggling a channel auto-saves, and the bulk summary applies (AC-07/09)', async ({
  page,
}) => {
  await openSettings(page);
  await settingsNav(page).getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

  await page.getByRole('switch', { name: 'Email — Expense approved' }).click();
  await expect(page.getByText('Preferences saved')).toBeVisible();

  await page.getByRole('combobox', { name: 'Notification Summary frequency' }).click();
  await page.getByRole('option', { name: 'Weekly Digest' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Summary applied')).toBeVisible();
});

async function openSecurity(page: Parameters<typeof fillLoginForm>[0]) {
  await openSettings(page);
  await settingsNav(page).getByRole('link', { name: 'Security' }).click();
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
}

test('Security: changing the password confirms and does not sign the user out (AC-01)', async ({
  page,
}) => {
  await openSecurity(page);

  await page.getByLabel('Current password').fill(DEMO_PASSWORD);
  await page.getByLabel('New password').fill('New-Str0ng-Pass!1');
  await page.getByLabel('Confirm new password').fill('New-Str0ng-Pass!1');
  await page.getByRole('button', { name: 'Update password' }).click();

  await expect(page.getByText('Password updated')).toBeVisible();
  // Still signed in on this device — the current session is preserved (AC-01).
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
});

test('Security: 2FA setup renders the QR entirely in the browser (AC-03)', async ({ page }) => {
  await openSecurity(page);
  await page.getByRole('button', { name: 'Enable authenticator app' }).click();

  await expect(page.getByRole('heading', { name: 'Scan the QR code' })).toBeVisible();
  await expect(page.getByTestId('totp-qr')).toBeVisible();
  await page.getByRole('button', { name: /can't scan a QR code/ }).click();
  await expect(page.getByTestId('totp-manual-secret')).toBeVisible();
});

test('Security: the current session cannot be signed out, but another can (AC-08/09)', async ({
  page,
}) => {
  await openSecurity(page);

  const currentCard = page.getByTestId('session-card').filter({ hasText: 'This device' });
  await expect(currentCard.getByRole('button', { name: 'Sign out this device' })).toBeDisabled();

  const otherCard = page.getByTestId('session-card').filter({ hasText: 'Firefox on Windows' });
  await otherCard.getByRole('button', { name: 'Sign out this device' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Device signed out')).toBeVisible();
  await expect(page.getByText('Firefox on Windows')).toHaveCount(0);
});

test('Security: removing a trusted device confirms (AC-10)', async ({ page }) => {
  await openSecurity(page);

  const device = page.getByTestId('trusted-device').first();
  await device.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Device removed')).toBeVisible();
});
