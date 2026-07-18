import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import type { MockBackend } from './support/fixtures';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  fillLoginForm,
  navigateSpa,
  signUp,
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

const FRESH_PASSWORD = 'Fresh-Owner-Password-1';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Onboarding is gated: only a not-yet-onboarded account can enter the KYB wizard (US-CW-004
 * AC-09/AC-10), and the demo seed user is already approved. So every wizard test drives a freshly
 * signed-up-and-verified account, which — being in_progress — lands directly in the wizard when
 * its verification completes on the dashboard route (AC-09 for the sign-up funnel).
 */
async function startOnboardingAsFreshUser(page: Page, mockBackend: MockBackend, email: string) {
  await signUp(page, email, FRESH_PASSWORD);
  const token = await mockBackend.issueVerificationTokenForE2E(email, FRESH_PASSWORD);
  await navigateSpa(page, `/verify?token=${token}`);
  await expect(page).toHaveURL(/\/onboarding\/business/);
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
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'happy-path@clearline.dev');

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
    // The approved creator is an Owner with Controller-tier permissions, so the role-based home is
    // the spend dashboard (US-CW-001/US-CW-015).
    await expect(page).toHaveURL(/\/dashboard$/);

    // The approved creator is provisioned as the Owner (US-CW-030): Controller-tier nav an
    // Employee would never see — Budget Management and Audit Log — is now present, confirming the
    // elevation end-to-end rather than just that onboarding finished.
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByText('Budget Management')).toBeVisible();
    await expect(nav.getByText('Audit Log')).toBeVisible();
  });

  test('routes a not-yet-onboarded user who lands on the dashboard into the wizard (AC-09)', async ({
    page,
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'gated-owner@clearline.dev');

    // Already in the wizard from sign-up; a direct hit on the dashboard bounces straight back into
    // it because onboarding isn't complete.
    await navigateSpa(page, '/');
    await expect(page).toHaveURL(/\/onboarding\/business/);
  });

  test('routes an already-approved user who opens a wizard URL to the dashboard (AC-10)', async ({
    page,
  }) => {
    // The demo seed user is an established, already-onboarded business (approved), so it lands on
    // its role-based home (the spend dashboard for this Finance Manager) and can never re-enter the
    // wizard.
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);

    await navigateSpa(page, '/onboarding/business');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the inline EIN error when the registry can't verify it (AC-04)", async ({
    page,
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'ein-error@clearline.dev');

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
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'resume-step@clearline.dev');

    await fillBusinessInfo(page);
    const response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;
    await expect(page).toHaveURL(/\/onboarding\/owners/);

    await navigateSpa(page, '/onboarding/review');
    await expect(page).toHaveURL(/\/onboarding\/owners/);
  });

  test('tells a different person hitting a claimed EIN to ask for an invite — no sign-in CTA (AC-08)', async ({
    page,
    mockBackend,
  }) => {
    // A first account onboards, claiming OTHER_KNOWN_EIN and becoming its Owner.
    await startOnboardingAsFreshUser(page, mockBackend, 'first-owner@clearline.dev');
    await fillBusinessInfo(page, { ein: OTHER_KNOWN_EIN, legalName: 'Second Owner Co' });
    let response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;
    await expect(page).toHaveURL(/\/onboarding\/owners/);

    // A *different* person attempts to onboard the same EIN. They aren't that business's Owner and
    // have no Clearline credentials of their own, so "sign in instead" would be wrong (US-CW-004
    // AC-08, added by EPIC-CW-017): they're told to ask their admin for an invite, with no CTA.
    await startOnboardingAsFreshUser(page, mockBackend, 'dup-owner@clearline.dev');
    await fillBusinessInfo(page, { ein: OTHER_KNOWN_EIN });
    response = waitForApiResponse(page, '/api/onboarding/business');
    await page.getByRole('button', { name: 'Continue' }).click();
    await response;

    await expect(page.getByText('Your business already has a Clearline account')).toBeVisible();
    await expect(page.getByText(/Ask your organization.s admin to invite you/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });

  test('blocks further attempts and shows a support reference after 3 failed document uploads (AC-04)', async ({
    page,
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'doc-blocked@clearline.dev');
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
    mockBackend,
  }) => {
    await startOnboardingAsFreshUser(page, mockBackend, 'under-review@clearline.dev');
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
