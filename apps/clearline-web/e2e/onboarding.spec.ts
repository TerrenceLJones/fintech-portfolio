import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  fillLoginForm,
  navigateSpa,
  waitForApiResponse,
} from './support/helpers';

// Registry-known EINs — see libs/mock-backend/src/fixtures/onboarding.fixture.ts.
const KNOWN_EIN = '12-3456789';
const OTHER_KNOWN_EIN = '98-7654321';
const UNKNOWN_EIN = '00-0000000';

// Real, sharp, well-exposed 64x64 checkerboard PNGs — the client-side glare/blur quality gate
// (useSubmitDocument) runs against genuine pixel data in a real browser, so a trivial 1x1 or
// flat-color file would be rejected as "blurry" before ever reaching the server. Paths are
// relative to the Playwright process's cwd (apps/clearline-web), same as playwright.config.ts's
// own testDir resolution.
const SHARP_DOC = 'e2e/fixtures/drivers-license-sharp.png';
const UNRECOGNIZED_DOC = 'e2e/fixtures/unrecognized-document.png';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
}

async function fillBusinessInfo(page: Page, overrides: { ein?: string; legalName?: string } = {}) {
  await page.getByLabel('Legal business name').fill(overrides.legalName ?? 'Northwind Labs, Inc.');
  await page.getByLabel('EIN', { exact: true }).fill(overrides.ein ?? KNOWN_EIN);
  await page.getByLabel('Structure').fill('C-Corporation');
  await page.getByLabel('Registered address').fill('220 Mission St');
  await page.getByLabel('City').fill('San Francisco');
  await page.getByLabel('State', { exact: true }).fill('CA');
  await page.getByLabel('Postal code').fill('94105');
}

async function addOwner(
  page: Page,
  owner: {
    firstName: string;
    lastName: string;
    ownershipPercent: string;
    dateOfBirth?: string;
    ssnItin?: string;
  },
) {
  await page.getByLabel('First name').fill(owner.firstName);
  await page.getByLabel('Last name').fill(owner.lastName);
  await page.getByLabel('Ownership percent').fill(owner.ownershipPercent);
  if (owner.dateOfBirth) await page.getByLabel('Date of birth').fill(owner.dateOfBirth);
  if (owner.ssnItin) await page.getByLabel('SSN / ITIN').fill(owner.ssnItin);
  const response = waitForApiResponse(page, '/api/onboarding/owners');
  await page.getByRole('button', { name: '+ Add owner' }).click();
  await response;
}

test.describe('Business onboarding & KYB (US-CW-004, US-CW-005)', () => {
  test('happy path: business info → owner → document upload → review → approved (AC-01, AC-03, AC-05, AC-08)', async ({
    page,
  }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await navigateSpa(page, '/onboarding/business');

    await fillBusinessInfo(page);
    let response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;
    await expect(page).toHaveURL(/\/onboarding\/owners/);

    await addOwner(page, {
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: '60',
      dateOfBirth: '1986-04-12',
      ssnItin: '123-45-4417',
    });
    await expect(page.getByText('ID verification required')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/documents/);

    await page.getByLabel(/browse/i).setInputFiles(SHARP_DOC);
    await expect(page.getByText('Quality check passed')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/review/);
    await expect(page.getByText(/Northwind Labs, Inc\./)).toBeVisible();

    await page.getByRole('checkbox').click();
    response = waitForApiResponse(page, '/api/onboarding/review/submit');
    await page.getByRole('button', { name: 'Submit for verification' }).click();
    await response;

    await expect(page).toHaveURL(/\/onboarding\/status/);
    await expect(page.getByText('Your account is approved')).toBeVisible();

    await page.getByRole('button', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
  });

  test("shows the inline EIN error when the registry can't verify it (AC-04)", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await navigateSpa(page, '/onboarding/business');

    await fillBusinessInfo(page, { ein: UNKNOWN_EIN });
    const response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;

    await expect(
      page.getByText("We couldn't verify this EIN. Please check and try again."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/business/);
  });

  // A literal full-page reload can't be exercised here: the in-memory access token is cleared by
  // design on reload (US-CW-001 AC-01), and MSW's Service Worker can't really round-trip the
  // refresh-token cookie in a browser (Set-Cookie is a forbidden response header — see browser.ts
  // and session.spec.ts, which works around the same limitation for auth-only flows). What IS
  // faithfully testable without fighting that mocking limitation is the actual mechanism AC-02
  // depends on: onboarding progress is authoritative server-side (OnboardingService), so navigating
  // straight to a step ahead of currentStep redirects back to the real current step exactly as a
  // resumed session would.
  test('redirects to the true current step when navigating ahead of it (AC-01, AC-02)', async ({
    page,
  }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await navigateSpa(page, '/onboarding/business');

    await fillBusinessInfo(page);
    const response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;
    await expect(page).toHaveURL(/\/onboarding\/owners/);

    await navigateSpa(page, '/onboarding/review');
    await expect(page).toHaveURL(/\/onboarding\/owners/);
  });

  test('routes a duplicate EIN to a sign-in CTA instead of a second onboarding (AC-07)', async ({
    page,
    mockBackend,
  }) => {
    // A different account onboards first, claiming OTHER_KNOWN_EIN.
    await page.goto('/signup');
    const signUpResponse = waitForApiResponse(page, '/api/auth/signup');
    await page.getByLabel('Work email').fill('second-owner@clearline.dev');
    await page.getByLabel('Password', { exact: true }).fill('Second-Owner-Password-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await signUpResponse;

    const verificationToken = await mockBackend.issueVerificationTokenForE2E(
      'second-owner@clearline.dev',
      'Second-Owner-Password-1',
    );
    await navigateSpa(page, `/verify?token=${verificationToken}`);
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);

    await navigateSpa(page, '/onboarding/business');
    await fillBusinessInfo(page, { ein: OTHER_KNOWN_EIN, legalName: 'Second Owner Co' });
    let response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;
    await expect(page).toHaveURL(/\/onboarding\/owners/);

    // Now the demo user attempts to onboard a business with the same EIN.
    await page.goto('/login');
    await fillLoginForm(page, DEMO_EMAIL, DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);

    await navigateSpa(page, '/onboarding/business');
    await fillBusinessInfo(page, { ein: OTHER_KNOWN_EIN });
    response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;

    await expect(
      page.getByText('It looks like your business already has an account. Sign in instead.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('blocks further attempts and shows a support reference after 3 failed document uploads (AC-04)', async ({
    page,
  }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await navigateSpa(page, '/onboarding/business');
    await fillBusinessInfo(page);
    let response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;

    await addOwner(page, {
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: '60',
      dateOfBirth: '1986-04-12',
      ssnItin: '123-45-4417',
    });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/documents/);

    // First attempt uses the idle dropzone's "browse" input; once quality-check fails with
    // wrong_type, the component swaps to a "Choose a different file" retry button/input instead
    // (see DocumentDropzone) — the label to target changes on every subsequent attempt.
    response = waitForApiResponse(page, '/api/onboarding/documents');
    await page.getByLabel(/browse/i).setInputFiles(UNRECOGNIZED_DOC);
    await response;
    await expect(
      page.getByText(
        "This doesn't look like a valid ID. Please upload a driver's license, passport, or state ID.",
      ),
    ).toBeVisible();

    response = waitForApiResponse(page, '/api/onboarding/documents');
    await page.getByLabel(/choose a different file/i).setInputFiles(UNRECOGNIZED_DOC);
    await response;
    await expect(
      page.getByText(
        "This doesn't look like a valid ID. Please upload a driver's license, passport, or state ID.",
      ),
    ).toBeVisible();

    response = waitForApiResponse(page, '/api/onboarding/documents');
    await page.getByLabel(/choose a different file/i).setInputFiles(UNRECOGNIZED_DOC);
    await response;

    await expect(page).toHaveURL(/\/onboarding\/status/);
    await expect(page.getByText("We couldn't verify your documents")).toBeVisible();
    await expect(page.getByText(/SR-/)).toBeVisible();
  });

  test('routes a watchlist-matching business to the neutral under-review status without restricted terms (AC-05)', async ({
    page,
  }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await navigateSpa(page, '/onboarding/business');
    // 'vostok trading' is a mock watchlist fixture — see libs/mock-backend/src/fixtures/onboarding.fixture.ts.
    await fillBusinessInfo(page, { ein: OTHER_KNOWN_EIN, legalName: 'Vostok Trading LLC' });
    let response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;

    await addOwner(page, { firstName: 'Marcus', lastName: 'Okafor', ownershipPercent: '10' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/documents/);
    // No owner requires KYC, so Continue is immediately available.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/review/);

    await page.getByRole('checkbox').click();
    response = waitForApiResponse(page, '/api/onboarding/review/submit');
    await page.getByRole('button', { name: 'Submit for verification' }).click();
    await response;

    await expect(page).toHaveURL(/\/onboarding\/status/);
    await expect(page.getByText('Your application is under review')).toBeVisible();
    const bodyText = (await page.textContent('body'))?.toLowerCase() ?? '';
    expect(bodyText).not.toMatch(/sanctions|watchlist|flagged/);
  });
});
